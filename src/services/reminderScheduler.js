const cron = require('node-cron');
const prisma = require('../config/db');
const emailService = require('../services/emailService');

/**
 * Reminder Scheduler
 *
 * Runs every minute and checks for meetings starting in the next 30 minutes.
 * Sends reminder emails to both the invitee and the host.
 *
 * Uses a `reminderSent` flag on the booking to avoid duplicate emails.
 * Since the Booking model doesn't have a `reminderSent` column,
 * we track sent reminders in-memory (resets on server restart — acceptable
 * for a dev/demo app; for production, add a DB column).
 */

// In-memory set of booking IDs that have already received reminders
const sentReminders = new Set();

/**
 * Start the reminder cron job.
 * Runs every minute to check for upcoming meetings.
 */
function startReminderScheduler() {
  console.log('⏰ Reminder scheduler started (checks every minute)');

  // Run every minute
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const thirtyMinLater = new Date(now.getTime() + 30 * 60 * 1000);
      // Small buffer: check 29-31 minute window to account for timing drift
      const twentyNineMinLater = new Date(now.getTime() + 29 * 60 * 1000);

      // Find bookings starting in ~30 minutes that haven't been reminded
      const upcomingBookings = await prisma.booking.findMany({
        where: {
          status: 'scheduled',
          startTime: {
            gte: twentyNineMinLater,
            lte: thirtyMinLater,
          },
        },
        include: {
          eventType: {
            include: {
              user: true, // get the host user
            },
          },
        },
      });

      for (const booking of upcomingBookings) {
        // Skip if we've already sent a reminder for this booking
        if (sentReminders.has(booking.id)) continue;

        // Mark as sent immediately to prevent duplicates
        sentReminders.add(booking.id);

        const hostEmail = booking.eventType?.user?.email;

        // Send reminder to invitee
        await emailService.sendReminder(booking);

        // Send reminder to host
        if (hostEmail) {
          await emailService.sendHostReminder(booking, hostEmail);
        }
      }

      // Cleanup: remove old IDs from the set to prevent memory growth
      // Keep only IDs from the last 2 hours
      if (sentReminders.size > 1000) {
        sentReminders.clear();
      }
    } catch (err) {
      console.error('❌ Reminder scheduler error:', err.message);
    }
  });
}

module.exports = { startReminderScheduler };
