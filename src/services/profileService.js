const prisma = require('../config/db');
const cloudinary = require('../config/cloudinary');

/**
 * Service layer for user profile operations.
 * Handles profile updates and Cloudinary avatar uploads.
 */
const profileService = {
  /**
   * Get the full user profile by ID.
   *
   * @param {number} userId
   * @returns {object} User record
   */
  async getProfile(userId) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        createdAt: true,
      },
    });
  },

  /**
   * Update user profile fields (name only — avatar is handled separately).
   *
   * @param {number} userId
   * @param {object} data - { name }
   * @returns {object} Updated user record
   */
  async updateProfile(userId, data) {
    const updateData = {};

    if (data.name && data.name.trim()) {
      updateData.name = data.name.trim();
    }

    return prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        createdAt: true,
      },
    });
  },

  /**
   * Upload an avatar image to Cloudinary and update the user record.
   * Uses a stream upload from the multer memory buffer.
   *
   * @param {number} userId
   * @param {Buffer} fileBuffer - Image file buffer from multer
   * @returns {object} Updated user record with new avatar URL
   */
  async uploadAvatar(userId, fileBuffer) {
    // Upload to Cloudinary via stream
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'calendly-clone/avatars',
          public_id: `user_${userId}_${Date.now()}`,
          transformation: [
            { width: 400, height: 400, crop: 'fill', gravity: 'face' },
            { quality: 'auto', fetch_format: 'auto' },
          ],
          overwrite: true,
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.end(fileBuffer);
    });

    // Update user avatar in database
    return prisma.user.update({
      where: { id: userId },
      data: { avatar: result.secure_url },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        createdAt: true,
      },
    });
  },

  /**
   * Remove the user's avatar (reset to null).
   *
   * @param {number} userId
   * @returns {object} Updated user record
   */
  async removeAvatar(userId) {
    return prisma.user.update({
      where: { id: userId },
      data: { avatar: null },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        createdAt: true,
      },
    });
  },
};

module.exports = profileService;
