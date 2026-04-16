const prisma = require('../config/db');
const { NotFoundError, BadRequestError } = require('../utils/errors');
const emailService = require('./emailService');

const VALID_KINDS = ['one-on-one', 'group', 'round-robin', 'collective'];

/**
 * Service layer for EventType CRUD operations.
 * All operations are scoped to the authenticated user.
 */
const eventTypeService = {
  /**
   * Get all event types for the authenticated user.
   * Includes co-hosts for round-robin/collective events.
   */
  async getAll(userId) {
    return prisma.eventType.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { bookings: true },
        },
        coHosts: {
          include: {
            user: { select: { id: true, name: true, email: true, avatar: true } },
          },
        },
      },
    });
  },

  /**
   * Get a single event type by ID (must belong to the user).
   */
  async getById(id, userId) {
    const eventType = await prisma.eventType.findFirst({
      where: { id: parseInt(id), userId },
      include: {
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
   * Create a new event type for the authenticated user.
   * Supports all 4 kinds: one-on-one, group, round-robin, collective.
   *
   * @param {object} data - { name, duration, slug, color, kind, maxInvitees, coHostEmails[] }
   * @param {number} userId - The authenticated user's ID
   */
  async create(data, userId) {
    const { name, duration, slug, color, kind, maxInvitees, coHostEmails, locationType, locationValue } = data;

    if (!name || !duration) {
      throw new BadRequestError('Name and duration are required');
    }

    const eventKind = kind || 'one-on-one';
    if (!VALID_KINDS.includes(eventKind)) {
      throw new BadRequestError(`Invalid event kind. Must be one of: ${VALID_KINDS.join(', ')}`);
    }

    // Validate maxInvitees for group events
    const groupMax = eventKind === 'group' ? Math.max(2, parseInt(maxInvitees) || 2) : 1;

    // Auto-generate slug from name + userId, ensuring uniqueness
    const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    let finalSlug = slug || `${baseSlug}-${userId}`;

    // Check if slug exists and append counter if needed
    let slugExists = await prisma.eventType.findUnique({ where: { slug: finalSlug } });
    let counter = 2;
    while (slugExists) {
      finalSlug = `${baseSlug}-${userId}-${counter}`;
      slugExists = await prisma.eventType.findUnique({ where: { slug: finalSlug } });
      counter++;
    }

    // Resolve co-host emails for round-robin/collective
    let coHostUsers = [];
    if ((eventKind === 'round-robin' || eventKind === 'collective') && coHostEmails && coHostEmails.length > 0) {
      coHostUsers = await prisma.user.findMany({
        where: {
          email: { in: coHostEmails },
          id: { not: userId }, // exclude the creator
        },
        select: { id: true, name: true, email: true },
      });
    }
    const coHostUserIds = coHostUsers.map((u) => u.id);

    // Get host name for notification emails
    const hostUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    // Create event type with co-hosts in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const eventType = await tx.eventType.create({
        data: {
          name,
          duration: parseInt(duration),
          slug: finalSlug,
          color: color || '#006BFF',
          kind: eventKind,
          maxInvitees: groupMax,
          locationType: locationType || 'none',
          locationValue: locationValue || '',
          userId,
        },
      });

      // Create co-host records
      if (coHostUserIds.length > 0) {
        await tx.eventTypeCoHost.createMany({
          data: coHostUserIds.map((coHostId) => ({
            eventTypeId: eventType.id,
            userId: coHostId,
          })),
        });
      }

      // Return with co-hosts included
      return tx.eventType.findUnique({
        where: { id: eventType.id },
        include: {
          coHosts: {
            include: {
              user: { select: { id: true, name: true, email: true, avatar: true } },
            },
          },
        },
      });
    });

    // Send invitation emails to co-hosts (non-blocking)
    for (const coHost of coHostUsers) {
      emailService.sendCoHostInvitation({
        coHostEmail: coHost.email,
        coHostName: coHost.name,
        eventName: name,
        eventKind,
        duration: parseInt(duration),
        hostName: hostUser?.name || 'A team member',
        slug: finalSlug,
      }).catch((err) => console.error('Co-host email error:', err.message));
    }

    return result;
  },

  /**
   * Update an existing event type (must belong to the user).
   */
  async update(id, data, userId) {
    const existing = await prisma.eventType.findFirst({
      where: { id: parseInt(id), userId },
      include: {
        coHosts: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    });
    if (!existing) throw new NotFoundError('Event type not found');

    const { name, duration, slug, color, kind, maxInvitees, coHostEmails, locationType, locationValue } = data;

    const eventKind = kind || existing.kind;
    if (!VALID_KINDS.includes(eventKind)) {
      throw new BadRequestError(`Invalid event kind. Must be one of: ${VALID_KINDS.join(', ')}`);
    }

    // Detect location change
    const newLocationType = locationType !== undefined ? locationType : existing.locationType;
    const newLocationValue = locationValue !== undefined ? locationValue : existing.locationValue;
    const locationChanged = newLocationType !== existing.locationType || newLocationValue !== existing.locationValue;

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.eventType.update({
        where: { id: parseInt(id) },
        data: {
          ...(name && { name }),
          ...(duration && { duration: parseInt(duration) }),
          ...(slug && { slug }),
          ...(color && { color }),
          kind: eventKind,
          maxInvitees: eventKind === 'group' ? Math.max(2, parseInt(maxInvitees) || existing.maxInvitees) : 1,
          locationType: newLocationType,
          locationValue: newLocationValue,
        },
      });

      // Update co-hosts if provided
      if (coHostEmails !== undefined && (eventKind === 'round-robin' || eventKind === 'collective')) {
        await tx.eventTypeCoHost.deleteMany({ where: { eventTypeId: parseInt(id) } });
        if (coHostEmails && coHostEmails.length > 0) {
          const coHostUsers = await tx.user.findMany({
            where: { email: { in: coHostEmails }, id: { not: userId } },
            select: { id: true },
          });
          if (coHostUsers.length > 0) {
            await tx.eventTypeCoHost.createMany({
              data: coHostUsers.map((u) => ({ eventTypeId: parseInt(id), userId: u.id })),
            });
          }
        }
      } else if (eventKind === 'one-on-one' || eventKind === 'group') {
        await tx.eventTypeCoHost.deleteMany({ where: { eventTypeId: parseInt(id) } });
      }

      return tx.eventType.findUnique({
        where: { id: parseInt(id) },
        include: {
          coHosts: {
            include: {
              user: { select: { id: true, name: true, email: true, avatar: true } },
            },
          },
        },
      });
    });

    // If location changed, notify invitees and co-hosts
    if (locationChanged) {
      const hostUser = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });

      // Get upcoming bookings for this event
      const upcomingBookings = await prisma.booking.findMany({
        where: {
          eventTypeId: parseInt(id),
          status: 'scheduled',
          startTime: { gte: new Date() },
        },
        select: { email: true, name: true, inviteeId: true },
      });

      // Collect all emails to notify: invitees + co-hosts
      const emailsToNotify = new Set();
      const namesMap = {};
      for (const b of upcomingBookings) {
        emailsToNotify.add(b.email);
        namesMap[b.email] = b.name;
      }
      for (const ch of (existing.coHosts || [])) {
        emailsToNotify.add(ch.user.email);
        namesMap[ch.user.email] = ch.user.name;
      }

      // Send notifications (non-blocking)
      for (const email of emailsToNotify) {
        emailService.sendLocationUpdate({
          recipientEmail: email,
          recipientName: namesMap[email] || '',
          eventName: result.name,
          locationType: newLocationType,
          locationValue: newLocationValue,
          hostName: hostUser?.name || 'The host',
        }).catch((err) => console.error('Location update email error:', err.message));
      }
    }

    return result;
  },

  /**
   * Delete an event type and all its bookings (must belong to the user).
   */
  async delete(id, userId) {
    const existing = await prisma.eventType.findFirst({
      where: { id: parseInt(id), userId },
    });
    if (!existing) throw new NotFoundError('Event type not found');

    return prisma.eventType.delete({
      where: { id: parseInt(id) },
    });
  },
};

module.exports = eventTypeService;
