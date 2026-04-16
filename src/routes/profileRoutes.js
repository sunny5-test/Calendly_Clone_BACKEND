const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const authMiddleware = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');

// All profile routes require authentication
router.use(authMiddleware);

// GET /api/profile — Get user profile
router.get('/', profileController.getProfile);

// PUT /api/profile — Update profile (name)
router.put('/', profileController.updateProfile);

// POST /api/profile/avatar — Upload avatar image
router.post('/avatar', upload.single('avatar'), profileController.uploadAvatar);

// DELETE /api/profile/avatar — Remove avatar
router.delete('/avatar', profileController.removeAvatar);

// GET /api/profile/refresh-token — Get a fresh JWT with updated profile data
router.get('/refresh-token', profileController.refreshToken);

module.exports = router;
