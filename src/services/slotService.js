const prisma = require('../config/db');
const { NotFoundError } = require('../utils/errors');
const { generateTimeSlots } = require('../utils/timeUtils');
const { getDay } = require('date-fns');
const { fromZonedTime } = require('date-fns-tz');

/**
 * Service layer for public-facing slot generation.
 * Handles generating available time slots based on event kind:
 * - one-on-one: 1 booking per slot
 * - group: up to maxInvitees per slot
 * - round-robin: union of all hosts' availability, per-host blocking
 * - collective: intersection of all hosts' availability
 */
const slotService = {
  /**
   * Get event type details by slug (public).
   */
  async getEventBySlug(slug) {
    const eventType = await prisma.eventType.findUnique({
      where: { slug },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatar: true },
        },
        coHosts: {
          include: {
            user: { select: { id: true, name: true, email: true, avatar: true } },
          },
        },
      },
    });

    if (!eventType) throw new NotFoundError('Event type not found');
    return eventType;
  },

  /**
   * Generate available time slots for a specific date and event type.
   * Dispatches to the appropriate strategy based on event kind.
   */
  async getAvailableSlots(slug, dateStr) {
    const eventType = await prisma.eventType.findUnique({
      where: { slug },
      include: {
        coHosts: { select: { userId: true } },
      },
    });
    if (!eventType) throw new NotFoundError('Event type not found');

    switch (eventType.kind) {
      case 'group':
        return this._getSlotsGroup(eventType, dateStr);
      case 'round-robin':
        return this._getSlotsRoundRobin(eventType, dateStr);
      case 'collective':
        return this._getSlotsCollective(eventType, dateStr);
      case 'one-on-one':
      default:
        return this._getSlotsOneOnOne(eventType, dateStr);
    }
  },

  /**
   * ONE-ON-ONE: Standard behavior. 1 booking blocks the slot.
   */
  async _getSlotsOneOnOne(eventType, dateStr) {
    const { availability, existingBookings } = await this._getAvailabilityAndBookings(
      eventType.userId, eventType.id, dateStr
    );
    if (!availability) return [];

    return generateTimeSlots(dateStr, eventType.duration, availability, existingBookings);
  },

  /**
   * GROUP: Slot remains available until bookings reach maxInvitees.
   */
  async _getSlotsGroup(eventType, dateStr) {
    const { availability, existingBookings } = await this._getAvailabilityAndBookings(
      eventType.userId, eventType.id, dateStr
    );
    if (!availability) return [];

    // Generate all candidate slots (ignoring conflicts)
    const allSlots = generateTimeSlots(dateStr, eventType.duration, availability, []);

    // For each slot, check how many bookings exist — keep slot if < maxInvitees
    return allSlots.filter((slot) => {
      const slotStart = new Date(slot.start);
      const slotEnd = new Date(slot.end);
      const bookingsInSlot = existingBookings.filter((b) => {
        const bStart = new Date(b.startTime);
        const bEnd = new Date(b.endTime);
        return bStart < slotEnd && bEnd > slotStart;
      });
      return bookingsInSlot.length < eventType.maxInvitees;
    }).map((slot) => {
      const slotStart = new Date(slot.start);
      const slotEnd = new Date(slot.end);
      const booked = existingBookings.filter((b) => {
        const bStart = new Date(b.startTime);
        const bEnd = new Date(b.endTime);
        return bStart < slotEnd && bEnd > slotStart;
      }).length;
      return {
        ...slot,
        spotsLeft: eventType.maxInvitees - booked,
        maxInvitees: eventType.maxInvitees,
      };
    });
  },

  /**
   * ROUND ROBIN: Union of all hosts' availability.
   * A slot is available if at least one host is free at that time.
   */
  async _getSlotsRoundRobin(eventType, dateStr) {
    // Get all host IDs (creator + co-hosts)
    const hostIds = [eventType.userId, ...eventType.coHosts.map((c) => c.userId)];
    const targetDate = new Date(dateStr + 'T12:00:00');
    const dayOfWeek = getDay(targetDate);

    // Get availability for ALL hosts on this day
    const availabilities = await prisma.availability.findMany({
      where: {
        userId: { in: hostIds },
        dayOfWeek: dayOfWeek,
      },
    });

    if (availabilities.length === 0) return [];

    // Get ALL bookings for this event type on this date
    const timezone = availabilities[0].timezone || 'Asia/Kolkata';
    const dayStartUTC = fromZonedTime(new Date(dateStr + 'T00:00:00'), timezone);
    const dayEndUTC = fromZonedTime(new Date(dateStr + 'T23:59:59'), timezone);

    const existingBookings = await prisma.booking.findMany({
      where: {
        eventTypeId: eventType.id,
        status: 'scheduled',
        startTime: { gte: dayStartUTC },
        endTime: { lte: new Date(dayEndUTC.getTime() + 1000) },
      },
      select: { startTime: true, endTime: true, assignedHostId: true },
    });

    // Generate slots from each host's availability (union)
    const allSlotsSet = new Map(); // key: start ISO → slot
    for (const avail of availabilities) {
      const slots = generateTimeSlots(dateStr, eventType.duration, avail, []);
      for (const slot of slots) {
        if (!allSlotsSet.has(slot.start)) {
          allSlotsSet.set(slot.start, slot);
        }
      }
    }

    // Filter: slot is available if at least one host has no booking at that time
    const availableSlots = [];
    for (const slot of allSlotsSet.values()) {
      const slotStart = new Date(slot.start);
      const slotEnd = new Date(slot.end);

      // Check which hosts are free for this slot
      const busyHostIds = existingBookings
        .filter((b) => {
          const bStart = new Date(b.startTime);
          const bEnd = new Date(b.endTime);
          return bStart < slotEnd && bEnd > slotStart;
        })
        .map((b) => b.assignedHostId)
        .filter(Boolean);

      const hasFreeHost = hostIds.some((id) => !busyHostIds.includes(id));
      if (hasFreeHost) {
        availableSlots.push(slot);
      }
    }

    return availableSlots.sort((a, b) => new Date(a.start) - new Date(b.start));
  },

  /**
   * COLLECTIVE: Intersection of all hosts' availability.
   * Slot is available only when ALL hosts are free.
   */
  async _getSlotsCollective(eventType, dateStr) {
    const hostIds = [eventType.userId, ...eventType.coHosts.map((c) => c.userId)];
    const targetDate = new Date(dateStr + 'T12:00:00');
    const dayOfWeek = getDay(targetDate);

    // ALL hosts must have availability on this day
    const availabilities = await prisma.availability.findMany({
      where: {
        userId: { in: hostIds },
        dayOfWeek: dayOfWeek,
      },
    });

    // If not all hosts have availability, no slots
    const hostsWithAvail = new Set(availabilities.map((a) => a.userId));
    if (hostIds.some((id) => !hostsWithAvail.has(id))) return [];

    // Find the intersection of availability windows
    let latestStart = '00:00';
    let earliestEnd = '23:59';
    let timezone = 'Asia/Kolkata';
    for (const avail of availabilities) {
      if (avail.startTime > latestStart) latestStart = avail.startTime;
      if (avail.endTime < earliestEnd) earliestEnd = avail.endTime;
      timezone = avail.timezone || timezone;
    }

    // If intersection is empty, no slots
    if (latestStart >= earliestEnd) return [];

    const intersectionAvail = {
      startTime: latestStart,
      endTime: earliestEnd,
      timezone,
    };

    // Get ALL bookings for ALL hosts on this date (not just this event type)
    const dayStartUTC = fromZonedTime(new Date(dateStr + 'T00:00:00'), timezone);
    const dayEndUTC = fromZonedTime(new Date(dateStr + 'T23:59:59'), timezone);

    // Get bookings from this event type
    const eventBookings = await prisma.booking.findMany({
      where: {
        eventTypeId: eventType.id,
        status: 'scheduled',
        startTime: { gte: dayStartUTC },
        endTime: { lte: new Date(dayEndUTC.getTime() + 1000) },
      },
      select: { startTime: true, endTime: true },
    });

    // Also check individual bookings of each host (from their other event types)
    const hostEventTypes = await prisma.eventType.findMany({
      where: { userId: { in: hostIds } },
      select: { id: true },
    });
    const hostEventTypeIds = hostEventTypes.map((et) => et.id);

    const allHostBookings = await prisma.booking.findMany({
      where: {
        eventTypeId: { in: hostEventTypeIds },
        status: 'scheduled',
        startTime: { gte: dayStartUTC },
        endTime: { lte: new Date(dayEndUTC.getTime() + 1000) },
      },
      select: { startTime: true, endTime: true },
    });

    // Merge all bookings as conflicts
    const allConflicts = [...eventBookings, ...allHostBookings];

    return generateTimeSlots(dateStr, eventType.duration, intersectionAvail, allConflicts);
  },

  /**
   * Helper: get availability and bookings for a single host + event type.
   */
  async _getAvailabilityAndBookings(userId, eventTypeId, dateStr) {
    const targetDate = new Date(dateStr + 'T12:00:00');
    const dayOfWeek = getDay(targetDate);

    const availability = await prisma.availability.findFirst({
      where: { userId, dayOfWeek },
    });

    if (!availability) return { availability: null, existingBookings: [] };

    const timezone = availability.timezone || 'Asia/Kolkata';
    const dayStartUTC = fromZonedTime(new Date(dateStr + 'T00:00:00'), timezone);
    const dayEndUTC = fromZonedTime(new Date(dateStr + 'T23:59:59'), timezone);

    const existingBookings = await prisma.booking.findMany({
      where: {
        eventTypeId,
        status: 'scheduled',
        startTime: { gte: dayStartUTC },
        endTime: { lte: new Date(dayEndUTC.getTime() + 1000) },
      },
      select: { startTime: true, endTime: true },
    });

    return { availability, existingBookings };
  },
};

module.exports = slotService;
