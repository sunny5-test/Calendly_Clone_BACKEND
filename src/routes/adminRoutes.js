const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

// All admin routes require authentication + admin privileges
router.use(authMiddleware);
router.use(adminMiddleware);

router.get('/stats', adminController.getDashboardStats);
router.get('/users', adminController.getAllUsers);
router.get('/bookings', adminController.getAllBookings);
router.get('/event-types', adminController.getAllEventTypes);
router.patch('/bookings/:id/cancel', adminController.cancelBooking);
router.delete('/users/:id', adminController.deleteUser);

module.exports = router;
