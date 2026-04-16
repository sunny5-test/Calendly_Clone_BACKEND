const passport = require('passport');
const authService = require('../services/authService');

/**
 * Controller for authentication operations.
 * Thin layer that delegates to the auth service and manages HTTP concerns.
 */
const authController = {
  /**
   * Initiate Google OAuth flow.
   * Redirects the user to Google's consent screen.
   */
  googleAuth: passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
  }),

  /**
   * Handle Google OAuth callback.
   * On success, generates a JWT and redirects to the frontend with the token.
   * On failure, redirects to the frontend with an error flag.
   */
  googleCallback: [
    passport.authenticate('google', {
      session: false,
      failureRedirect: `${'https://calendly-clone-front-end.vercel.app'}/login?error=auth_failed`,
    }),
    async (req, res, next) => {
      try {
        const token = authService.generateToken(req.user);
        const frontendUrl = 'https://calendly-clone-front-end.vercel.app';
        res.redirect(`${frontendUrl}/dashboard?token=${token}`);
      } catch (error) {
        next(error);
      }
    },
  ],

  /**
   * Get the currently authenticated user's profile.
   * Requires a valid JWT in the Authorization header.
   */
  async getMe(req, res, next) {
    try {
      res.json({
        success: true,
        data: {
          id: req.user.id,
          name: req.user.name,
          email: req.user.email,
          avatar: req.user.avatar,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Logout handler.
   * Since we use stateless JWT, logout is handled client-side by deleting the token.
   * This endpoint confirms the action.
   */
  async logout(req, res) {
    res.json({
      success: true,
      message: 'Logged out successfully. Please remove the token on the client.',
    });
  },
};

module.exports = authController;
