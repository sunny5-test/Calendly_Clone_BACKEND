const express = require('express');
const router = express.Router();
const availabilityController = require('../controllers/availabilityController');
const authMiddleware = require('../middleware/authMiddleware');

// All availability routes require authentication
router.use(authMiddleware);

router.get('/', availabilityController.getAll);
router.post('/', availabilityController.setAvailability);

module.exports = router;
