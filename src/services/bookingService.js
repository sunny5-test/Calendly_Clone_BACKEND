const prisma = require('../config/db');
const { NotFoundError, ConflictError, BadRequestError } = require('../utils/errors');
const emailService = require('./emailService');

/**
 * Service layer for Booking management.
 * Handles per-kind booking logic:
 * - one-on-one: standard 1:1 double-booking prevention
 * - group: allows up to maxInvitees per slot
 * - round-robin: assigns a rotating host
 * - collective: all co-hosts attend
 */
const bookingService = {
  /**
   * Create a new booking.
   * @param {object} data - Booking data
   * @param {object} inviteeUser - The authenticated invitee (req.user)
   */
  async create(data, inviteeUser) {
    const { eventTypeId, startTime, endTime } = data;
    const name = inviteeUser.name;
    const email = inviteeUser.email;

    if (!eventTypeId || !startTime || !endTime) {
      throw new BadRequestError('All fields are required: eventTypeId, startTime, endTime');
    }

    const newStart = new Date(startTime);
    const newEnd = new Date(endTime);

    if (newStart >= newEnd) {
      throw new BadRequestError('Start time must be before end time');
    }

    // Verify event type exists and get its kind
    const eventType = await prisma.eventType.findUnique({
      where: { id: parseInt(eventTypeId) },
      include: {
        coHosts: { select: { userId: true } },
      },
    });
    if (!eventType) throw new NotFoundError('Event type not found');

    // Prevent users from booking their own event types
    if (eventType.userId === inviteeUser.id) {
      throw new BadRequestError('You cannot book your own event type');
    }

    // Also prevent co-hosts from booking their own event
    const coHostIds = eventType.coHosts.map((c) => c.userId);
    if (coHostIds.includes(inviteeUser.id)) {
      throw new BadRequestError('Co-hosts cannot book their own event type');
    }

    // Dispatch to per-kind booking logic
    let booking;
    switch (eventType.kind) {
      case 'group':
        booking = await this._createGroupBooking(eventType, inviteeUser, newStart, newEnd);
        break;
      case 'round-robin':
        booking = await this._createRoundRobinBooking(eventType, inviteeUser, newStart, newEnd);
        break;
      case 'collective':
      case 'one-on-one':
      default:
        booking = await this._createStandardBooking(eventType, inviteeUser, newStart, newEnd);
        break;
    }

    // Send confirmation emails (non-blocking)
    try {
      const eventWithUser = await prisma.eventType.findUnique({
        where: { id: parseInt(eventTypeId) },
        include: { user: true },
      });
      const hostEmail = eventWithUser?.user?.email;
      if (hostEmail) {
        emailService.sendBookingConfirmation(booking, hostEmail);
      }
    } catch (emailErr) {
      console.error('Email send error (non-critical):', emailErr.message);
    }

    return booking;
  },

  /**
   * Standard booking (one-on-one, collective): 1 booking blocks the slot.
   */
  async _createStandardBooking(eventType, inviteeUser, newStart, newEnd) {
    return prisma.$transaction(async (tx) => {
      const overlap = await tx.booking.findFirst({
        where: {
          eventTypeId: eventType.id,
          status: 'scheduled',
          startTime: { lt: newEnd },
          endTime: { gt: newStart },
        },
      });

      if (overlap) {
        throw new ConflictError('This time slot is already booked. Please choose another time.');
      }

      return tx.booking.create({
        data: {
          eventTypeId: eventType.id,
          inviteeId: inviteeUser.id,
          name: inviteeUser.name,
          email: inviteeUser.email,
          startTime: newStart,
          endTime: newEnd,
          status: 'scheduled',
        },
        include: { eventType: true },
      });
    });
  },

  /**
   * Group booking: allows up to maxInvitees per slot.
   */
  async _createGroupBooking(eventType, inviteeUser, newStart, newEnd) {
    return prisma.$transaction(async (tx) => {
      // Count existing bookings in this slot
      const existingCount = await tx.booking.count({
        where: {
          eventTypeId: eventType.id,
          status: 'scheduled',
          startTime: { lt: newEnd },
          endTime: { gt: newStart },
        },
      });

      if (existingCount >= eventType.maxInvitees) {
        throw new ConflictError('This time slot is full. Please choose another time.');
      }

      // Check if this user already booked this slot
      const alreadyBooked = await tx.booking.findFirst({
        where: {
          eventTypeId: eventType.id,
          inviteeId: inviteeUser.id,
          status: 'scheduled',
          startTime: { lt: newEnd },
          endTime: { gt: newStart },
        },
      });

      if (alreadyBooked) {
        throw new ConflictError('You have already booked this time slot.');
      }

      return tx.booking.create({
        data: {
          eventTypeId: eventType.id,
          inviteeId: inviteeUser.id,
          name: inviteeUser.name,
          email: inviteeUser.email,
          startTime: newStart,
          endTime: newEnd,
          status: 'scheduled',
        },
        include: { eventType: true },
      });
    });
  },

  /**
   * Round-robin booking: assigns the next available host in rotation.
   */
  async _createRoundRobinBooking(eventType, inviteeUser, newStart, newEnd) {
    const hostIds = [eventType.userId, ...eventType.coHosts.map((c) => c.userId)];

    return prisma.$transaction(async (tx) => {
      // Get all bookings for this event type to determine rotation
      const existingBookings = await tx.booking.findMany({
        where: {
          eventTypeId: eventType.id,
          status: 'scheduled',
          startTime: { lt: newEnd },
          endTime: { gt: newStart },
        },
        select: { assignedHostId: true },
      });

      const busyHostIds = existingBookings
        .map((b) => b.assignedHostId)
        .filter(Boolean);

      // Find the next free host (round-robin: pick the host with fewest total bookings)
      const allBookings = await tx.booking.findMany({
        where: {
          eventTypeId: eventType.id,
          status: 'scheduled',
          assignedHostId: { not: null },
        },
        select: { assignedHostId: true },
      });

      // Count bookings per host
      const bookingCounts = {};
      for (const hId of hostIds) {
        bookingCounts[hId] = 0;
      }
      for (const b of allBookings) {
        if (bookingCounts[b.assignedHostId] !== undefined) {
          bookingCounts[b.assignedHostId]++;
        }
      }

      // Filter to hosts that aren't busy at this time, then pick the one with fewest bookings
      const freeHosts = hostIds.filter((id) => !busyHostIds.includes(id));
      if (freeHosts.length === 0) {
        throw new ConflictError('No hosts are available at this time. Please choose another slot.');
      }

      freeHosts.sort((a, b) => (bookingCounts[a] || 0) - (bookingCounts[b] || 0));
      const assignedHostId = freeHosts[0];

      return tx.booking.create({
        data: {
          eventTypeId: eventType.id,
          inviteeId: inviteeUser.id,
          assignedHostId,
          name: inviteeUser.name,
          email: inviteeUser.email,
          startTime: newStart,
          endTime: newEnd,
          status: 'scheduled',
        },
        include: { eventType: true },
      });
    });
  },

  /**
   * Get bookings filtered by type (upcoming or past),
   * scoped to the authenticated user (as host, co-host, OR invitee).
   */
  async getAll(type = 'upcoming', userId) {
    const now = new Date();

    // Event types where user is the primary host
    const userEventTypes = await prisma.eventType.findMany({
      where: { userId },
      select: { id: true },
    });
    const ownedEventTypeIds = userEventTypes.map((et) => et.id);

    // Event types where user is a co-host
    const coHostEntries = await prisma.eventTypeCoHost.findMany({
      where: { userId },
      select: { eventTypeId: true },
    });
    const coHostEventTypeIds = coHostEntries.map((e) => e.eventTypeId);

    // Merge all event type IDs where user is host or co-host
    const allHostEventTypeIds = [...new Set([...ownedEventTypeIds, ...coHostEventTypeIds])];

    const timeFilter = type === 'upcoming'
      ? { startTime: { gte: now }, status: 'scheduled' }
      : { OR: [{ startTime: { lt: now } }, { status: 'cancelled' }] };

    const bookings = await prisma.booking.findMany({
      where: {
        AND: [
          timeFilter,
          {
            OR: [
              // User is host or co-host
              ...(allHostEventTypeIds.length > 0 ? [{ eventTypeId: { in: allHostEventTypeIds } }] : []),
              // User is the invitee
              { inviteeId: userId },
            ],
          },
        ],
      },
      include: {
        eventType: {
          select: { name: true, duration: true, color: true, slug: true, userId: true, kind: true, locationType: true, locationValue: true },
        },
        invitee: {
          select: { name: true, email: true, avatar: true },
        },
      },
      orderBy: { startTime: type === 'upcoming' ? 'asc' : 'desc' },
    });

    // Determine role for each booking
    return bookings.map((booking) => {
      let role = 'invitee';
      if (ownedEventTypeIds.includes(booking.eventTypeId)) {
        role = 'host';
      } else if (coHostEventTypeIds.includes(booking.eventTypeId)) {
        role = 'co-host';
      }
      return { ...booking, role };
    });
  },

  /**
   * Cancel a booking by ID (host, co-host, or invitee can cancel).
   */
  async cancel(id, userId) {
    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(id) },
      include: {
        eventType: {
          include: { coHosts: { select: { userId: true } } },
        },
      },
    });
    if (!booking) throw new NotFoundError('Booking not found');

    const isHost = booking.eventType.userId === userId;
    const isCoHost = booking.eventType.coHosts?.some((c) => c.userId === userId);
    const isInvitee = booking.inviteeId === userId;
    if (!isHost && !isCoHost && !isInvitee) {
      throw new NotFoundError('Booking not found');
    }

    if (booking.status === 'cancelled') {
      throw new BadRequestError('Booking is already cancelled');
    }

    return prisma.booking.update({
      where: { id: parseInt(id) },
      data: { status: 'cancelled' },
      include: {
        eventType: {
          select: { name: true, duration: true },
        },
      },
    });
  },
};

module.exports = bookingService;
