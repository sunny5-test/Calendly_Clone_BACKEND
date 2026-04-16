const ADMIN_EMAIL = 'konda20006@gmail.com';

/**
 * Admin Authorization Middleware.
 * Must be used AFTER authMiddleware (req.user must already be set).
 * Checks if the authenticated user is the platform admin.
 */
function adminMiddleware(req, res, next) {
  if (!req.user || req.user.email !== ADMIN_EMAIL) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.',
    });
  }
  next();
}

module.exports = adminMiddleware;
