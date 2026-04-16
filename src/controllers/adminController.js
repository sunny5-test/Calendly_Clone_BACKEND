const adminService = require('../services/adminService');

/**
 * Controller for Admin dashboard operations.
 * All routes are guarded by authMiddleware + adminMiddleware.
 */
const adminController = {
  async getDashboardStats(req, res, next) {
    try {
      const stats = await adminService.getDashboardStats();
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  },

  async getAllUsers(req, res, next) {
    try {
      const users = await adminService.getAllUsers();
      res.json({ success: true, data: users });
    } catch (error) {
      next(error);
    }
  },

  async getAllBookings(req, res, next) {
    try {
      const type = req.query.type || 'upcoming';
      const bookings = await adminService.getAllBookings(type);
      res.json({ success: true, data: bookings });
    } catch (error) {
      next(error);
    }
  },

  async getAllEventTypes(req, res, next) {
    try {
      const eventTypes = await adminService.getAllEventTypes();
      res.json({ success: true, data: eventTypes });
    } catch (error) {
      next(error);
    }
  },

  async cancelBooking(req, res, next) {
    try {
      const booking = await adminService.cancelBooking(req.params.id);
      res.json({ success: true, data: booking });
    } catch (error) {
      next(error);
    }
  },

  async deleteUser(req, res, next) {
    try {
      await adminService.deleteUser(req.params.id, req.user.id);
      res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = adminController;
