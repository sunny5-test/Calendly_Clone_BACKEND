const availabilityService = require('../services/availabilityService');

/**
 * Controller for Availability management.
 * All operations are scoped to the authenticated user.
 */
const availabilityController = {
  async getAll(req, res, next) {
    try {
      const availability = await availabilityService.getAll(req.user.id);
      res.json({ success: true, data: availability });
    } catch (error) {
      next(error);
    }
  },

  async setAvailability(req, res, next) {
    try {
      const { schedules } = req.body;
      const availability = await availabilityService.setAvailability(schedules, req.user.id);
      res.json({ success: true, data: availability });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = availabilityController;
