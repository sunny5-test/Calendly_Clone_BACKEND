require('dotenv').config();

const express = require('express');
const cors = require('cors');
const passport = require('./config/passport');
const errorHandler = require('./middleware/errorHandler');

// Route imports
const authRoutes = require('./routes/authRoutes');
const eventTypeRoutes = require('./routes/eventTypeRoutes');
const availabilityRoutes = require('./routes/availabilityRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const profileRoutes = require('./routes/profileRoutes');
const publicRoutes = require('./routes/publicRoutes');
const publicController = require('./controllers/publicController');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ───────────────────────────────────────────
app.use(cors({
  origin: 'https://calendly-clone-front-end.vercel.app/',
  credentials: true,
}));
app.use(express.json());
app.use(passport.initialize());

// Request logging in development
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });
}

// ─── Routes ───────────────────────────────────────────────

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Calendly Clone API is running', timestamp: new Date().toISOString() });
});

// Auth routes
app.use('/api/auth', authRoutes);

// Admin routes
app.use('/api/event-types', eventTypeRoutes);
app.use('/api/availability', availabilityRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/profile', profileRoutes);

// Admin routes (require auth + admin check)
app.use('/api/admin', adminRoutes);

// Public routes (event details and slots — no auth required)
app.use('/api/event', publicRoutes);

// Booking route — requires auth (invitee must be logged in)
const authMiddleware = require('./middleware/authMiddleware');
app.post('/api/book', authMiddleware, publicController.book);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ─── Error Handler ────────────────────────────────────────
app.use(errorHandler);

const { startReminderScheduler } = require('./services/reminderScheduler');

// ─── Start Server ─────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Calendly Clone API running on http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/api/health\n`);

  // Start the 30-minute reminder cron job
  startReminderScheduler();
});

module.exports = app;
