const multer = require('multer');

/**
 * Multer middleware configured for memory storage.
 * Files are stored in memory as Buffer objects, which we then
 * stream directly to Cloudinary (no temp files on disk).
 *
 * Limits:
 * - Max file size: 5MB
 * - Accepted types: JPEG, PNG, WebP, GIF
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WebP, and GIF images are allowed.'), false);
    }
  },
});

module.exports = upload;
