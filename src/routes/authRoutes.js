const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

// Google OAuth routes
router.get('/google', authController.googleAuth);
router.get('/google/callback', ...authController.googleCallback);

// Protected routes (require valid JWT)
router.get('/me', authMiddleware, authController.getMe);

// Logout
router.post('/logout', authController.logout);

module.exports = router;
