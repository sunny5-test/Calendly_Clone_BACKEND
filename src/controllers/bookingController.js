const bookingService = require('../services/bookingService');
const prisma = require('../config/db');
const { generateICS } = require('../utils/calendarUtils');

/**
 * Controller for Booking management (admin-facing).
 * All operations are scoped to the authenticated user's event types.
 */
const bookingController = {
  async getAll(req, res, next) {
    try {
      const type = req.query.type || 'upcoming';
      const bookings = await bookingService.getAll(type, req.user.id);
      res.json({ success: true, data: bookings });
    } catch (error) {
      next(error);
    }
  },

  async cancel(req, res, next) {
    try {
      const booking = await bookingService.cancel(req.params.id, req.user.id);
      res.json({ success: true, data: booking });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/bookings/:id/calendar.ics
   * Download an ICS file for a booking.
   */
  async downloadICS(req, res, next) {
    try {
      const booking = await prisma.booking.findUnique({
        where: { id: parseInt(req.params.id) },
        include: {
          eventType: {
            include: { user: { select: { name: true, email: true } } },
          },
        },
      });

      if (!booking) {
        return res.status(404).json({ success: false, message: 'Booking not found' });
      }

      // Verify user has access (host, co-host, or invitee)
      const isHost = booking.eventType.userId === req.user.id;
      const isInvitee = booking.inviteeId === req.user.id;
      const coHost = await prisma.eventTypeCoHost.findFirst({
        where: { eventTypeId: booking.eventTypeId, userId: req.user.id },
      });

      if (!isHost && !isInvitee && !coHost) {
        return res.status(404).json({ success: false, message: 'Booking not found' });
      }

      const icsContent = generateICS({
        title: `${booking.eventType.name} — ${booking.name}`,
        startTime: booking.startTime,
        endTime: booking.endTime,
        description: `Meeting: ${booking.eventType.name}\nWith: ${booking.name} (${booking.email})\nDuration: ${booking.eventType.duration} min`,
        organizerEmail: booking.eventType.user?.email,
        organizerName: booking.eventType.user?.name,
      });

      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${booking.eventType.name.replace(/[^a-zA-Z0-9]/g, '_')}.ics"`);
      res.send(icsContent);
    } catch (error) {
      next(error);
    }
  },
};

module.exports = bookingController;
