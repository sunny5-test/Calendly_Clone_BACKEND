const slotService = require('../services/slotService');
const bookingService = require('../services/bookingService');

/**
 * Controller for public-facing booking flow.
 * Handles event lookup, slot generation, and booking creation.
 */
const publicController = {
  /**
   * GET /api/event/:slug — Get event type details for the public booking page.
   */
  async getEvent(req, res, next) {
    try {
      const eventType = await slotService.getEventBySlug(req.params.slug);
      res.json({ success: true, data: eventType });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/event/:slug/slots?date=YYYY-MM-DD — Get available time slots.
   */
  async getSlots(req, res, next) {
    try {
      const { slug } = req.params;
      const { date } = req.query;

      if (!date) {
        return res.status(400).json({
          success: false,
          message: 'Date query parameter is required (YYYY-MM-DD)',
        });
      }

      const slots = await slotService.getAvailableSlots(slug, date);
      res.json({ success: true, data: slots });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/book — Create a booking (requires authentication).
   * The logged-in user is the invitee.
   */
  async book(req, res, next) {
    try {
      const booking = await bookingService.create(req.body, req.user);
      res.status(201).json({ success: true, data: booking });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = publicController;
