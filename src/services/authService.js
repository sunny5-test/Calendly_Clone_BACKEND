const jwt = require('jsonwebtoken');
const prisma = require('../config/db');

/**
 * Service layer for authentication operations.
 * Handles Google OAuth user management and JWT token generation.
 */
const authService = {
  /**
   * Find an existing user by Google ID or email, or create a new one.
   * If a user with the same email exists (e.g., seeded admin), link it
   * to their Google account rather than creating a duplicate.
   *
   * @param {object} profile - Google OAuth profile object
   * @returns {object} The user record from the database
   */
  async findOrCreateGoogleUser(profile) {
    const googleId = profile.id;
    const email = profile.emails?.[0]?.value;
    const name = profile.displayName || 'Unknown';
    const avatar = profile.photos?.[0]?.value || null;

    // 1. Try to find by Google ID first (fastest, most precise)
    let user = await prisma.user.findUnique({
      where: { googleId },
    });

    if (user) {
      // Always refresh avatar and name from Google
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          avatar: avatar || user.avatar,
          name: name || user.name,
        },
      });
      return user;
    }

    // 2. Try to find by email (link existing account to Google)
    if (email) {
      user = await prisma.user.findUnique({
        where: { email },
      });

      if (user) {
        // Link existing account with Google credentials
        user = await prisma.user.update({
          where: { email },
          data: { googleId, avatar: avatar || user.avatar },
        });
        return user;
      }
    }

    // 3. Create a brand new user
    user = await prisma.user.create({
      data: {
        name,
        email: email || `google-${googleId}@no-email.com`,
        googleId,
        avatar,
      },
    });

    return user;
  },

  /**
   * Generate a signed JWT for the given user.
   *
   * @param {object} user - User record with at least an `id` field
   * @returns {string} Signed JWT token
   */
  generateToken(user) {
    return jwt.sign(
      { userId: user.id, email: user.email, name: user.name, avatar: user.avatar },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
  },

  /**
   * Verify and decode a JWT token.
   *
   * @param {string} token - JWT token string
   * @returns {object} Decoded payload
   * @throws {Error} If the token is invalid or expired
   */
  verifyToken(token) {
    return jwt.verify(token, process.env.JWT_SECRET);
  },
};

module.exports = authService;
