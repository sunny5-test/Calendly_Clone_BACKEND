const profileService = require('../services/profileService');
const authService = require('../services/authService');

/**
 * Controller for user profile operations.
 * Handles HTTP layer for profile viewing, updating, and avatar management.
 */
const profileController = {
  /**
   * GET /api/profile
   * Get the authenticated user's profile.
   */
  async getProfile(req, res, next) {
    try {
      const profile = await profileService.getProfile(req.user.id);
      res.json({ success: true, data: profile });
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /api/profile
   * Update the authenticated user's profile (name).
   */
  async updateProfile(req, res, next) {
    try {
      const { name } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Name is required.',
        });
      }

      if (name.trim().length > 100) {
        return res.status(400).json({
          success: false,
          message: 'Name must be 100 characters or fewer.',
        });
      }

      const updated = await profileService.updateProfile(req.user.id, { name });
      res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/profile/avatar
   * Upload a new avatar image via Cloudinary.
   * Expects multipart/form-data with a file field named "avatar".
   */
  async uploadAvatar(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No image file provided.',
        });
      }

      const updated = await profileService.uploadAvatar(req.user.id, req.file.buffer);
      res.json({ success: true, data: updated });
    } catch (error) {
      // Handle multer file size / type errors
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'File size must be under 5MB.',
        });
      }
      next(error);
    }
  },

  /**
   * DELETE /api/profile/avatar
   * Remove the user's avatar.
   */
  async removeAvatar(req, res, next) {
    try {
      const updated = await profileService.removeAvatar(req.user.id);
      res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/profile/refresh-token
   * Issue a fresh JWT with the latest user profile data.
   * Used after profile updates so the frontend JWT payload stays current.
   */
  async refreshToken(req, res, next) {
    try {
      const profile = await profileService.getProfile(req.user.id);
      const token = authService.generateToken(profile);
      res.json({ success: true, token });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = profileController;
