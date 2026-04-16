const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController');

// Public event details
router.get('/:slug', publicController.getEvent);

// Available time slots for a specific date
router.get('/:slug/slots', publicController.getSlots);

module.exports = router;
