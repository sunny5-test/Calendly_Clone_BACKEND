const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const authMiddleware = require('../middleware/authMiddleware');

// All booking routes require authentication
router.use(authMiddleware);

router.get('/', bookingController.getAll);
router.get('/:id/calendar.ics', bookingController.downloadICS);
router.patch('/:id/cancel', bookingController.cancel);

module.exports = router;
