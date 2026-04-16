const nodemailer = require('nodemailer');
const { getGoogleCalendarUrl, getOutlookCalendarUrl } = require('../utils/calendarUtils');

/**
 * Email Service — Sends booking confirmations and reminders via Gmail SMTP.
 *
 * Configuration:
 *   SMTP_USER  – your Gmail address
 *   SMTP_PASS  – a Google App Password (NOT your regular password)
 *
 * Generate an App Password:
 *   https://myaccount.google.com/apppasswords
 */

// ─── Transporter ──────────────────────────────────────────
let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS || process.env.SMTP_PASS === 'your_gmail_app_password') {
    console.warn('⚠️  Email: SMTP_USER / SMTP_PASS not configured — emails will be skipped.');
    return null;
  }

  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
}

// ─── Helpers ──────────────────────────────────────────────
function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatTime(date) {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });
}

// ─── HTML Email Template ──────────────────────────────────
function buildEmailHTML({ heading, preheader, bodyHTML, accentColor = '#006BFF' }) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${heading}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f4f6f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    .email-wrapper { max-width: 560px; margin: 0 auto; padding: 40px 20px; }
    .email-card { background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06); }
    .email-header { background: ${accentColor}; padding: 32px 32px 28px; text-align: center; }
    .email-header h1 { margin: 0; color: #ffffff; font-size: 22px; font-weight: 700; letter-spacing: -0.3px; }
    .email-header p { margin: 8px 0 0; color: rgba(255,255,255,0.85); font-size: 14px; }
    .email-body { padding: 32px; }
    .detail-row { display: flex; align-items: flex-start; padding: 14px 0; border-bottom: 1px solid #f0f2f5; }
    .detail-row:last-child { border-bottom: none; }
    .detail-icon { width: 36px; height: 36px; border-radius: 10px; background: ${accentColor}10; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-right: 14px; }
    .detail-label { font-size: 12px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 2px; }
    .detail-value { font-size: 15px; color: #111827; font-weight: 500; margin: 0; }
    .email-footer { padding: 20px 32px; background: #f9fafb; text-align: center; border-top: 1px solid #f0f2f5; }
    .email-footer p { margin: 0; font-size: 12px; color: #9ca3af; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
  </style>
</head>
<body>
  <!--[if mso]><span style="display:none !important;">${preheader}</span><![endif]-->
  <span style="display:none;font-size:1px;color:#f4f6f9;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</span>
  <div class="email-wrapper">
    <div class="email-card">
      <div class="email-header">
        <h1>${heading}</h1>
      </div>
      <div class="email-body">
        ${bodyHTML}
      </div>
      <div class="email-footer">
        <p>Calendly Clone • Automated notification</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ─── Build detail row HTML ────────────────────────────────
function detailRow(icon, label, value) {
  return `
    <div class="detail-row">
      <div class="detail-icon">${icon}</div>
      <div>
        <p class="detail-label">${label}</p>
        <p class="detail-value">${value}</p>
      </div>
    </div>`;
}

const icons = {
  calendar: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#006BFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  clock: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#006BFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>',
  user: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#006BFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  mail: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#006BFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
  event: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#006BFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
  bell: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF8C00" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>',
};

// ─── Public API ───────────────────────────────────────────
const emailService = {
  /**
   * Send a booking confirmation email to both the invitee and the host.
   *
   * @param {object} booking - Booking record (with eventType included)
   * @param {string} hostEmail - The host/admin email
   */
  async sendBookingConfirmation(booking, hostEmail) {
    const transport = getTransporter();
    if (!transport) return;

    const eventName = booking.eventType?.name || 'Meeting';
    const duration = booking.eventType?.duration || 30;
    const dateStr = formatDate(booking.startTime);
    const startStr = formatTime(booking.startTime);
    const endStr = formatTime(booking.endTime);

    // Generate calendar URLs
    const calendarTitle = `${eventName} — ${booking.name}`;
    const calendarDesc = `Meeting: ${eventName}\nWith: ${booking.name} (${booking.email})\nDuration: ${duration} min`;
    const googleCalUrl = getGoogleCalendarUrl({ title: calendarTitle, startTime: booking.startTime, endTime: booking.endTime, description: calendarDesc });
    const outlookCalUrl = getOutlookCalendarUrl({ title: calendarTitle, startTime: booking.startTime, endTime: booking.endTime, description: calendarDesc });

    const calendarButtons = `
      <div style="margin-top:24px;text-align:center;">
        <p style="margin:0 0 12px;font-size:13px;color:#6b7280;font-weight:600;">Add to your calendar:</p>
        <div>
          <a href="${googleCalUrl}" target="_blank" style="display:inline-block;padding:10px 20px;background:#006BFF;color:#ffffff;text-decoration:none;border-radius:8px;font-size:13px;font-weight:600;margin:0 6px 8px;">
            📅 Google Calendar
          </a>
          <a href="${outlookCalUrl}" target="_blank" style="display:inline-block;padding:10px 20px;background:#0078D4;color:#ffffff;text-decoration:none;border-radius:8px;font-size:13px;font-weight:600;margin:0 6px 8px;">
            📅 Outlook
          </a>
        </div>
      </div>`;

    // Build location row for emails
    const locationType = booking.eventType?.locationType;
    const locationValue = booking.eventType?.locationValue;
    const locationLabels = { 'google-meet': '🎥 Google Meet', 'teams': '💬 Microsoft Teams', 'zoom': '📹 Zoom', 'custom': '📍 In-Person' };
    const locationLabel = locationLabels[locationType] || '';
    const isLink = locationType && locationType !== 'custom' && locationType !== 'none' && locationValue;
    const locationRowHTML = locationType && locationType !== 'none'
      ? detailRow(
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#006BFF" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
          'Location',
          isLink ? `${locationLabel} — <a href="${locationValue}" style="color:#006BFF;">${locationValue}</a>` : `${locationLabel}${locationValue ? ' — ' + locationValue : ''}`
        )
      : '';

    // ── Email to INVITEE ──
    const inviteeBody = `
      <p style="font-size:15px;color:#374151;margin:0 0 20px;line-height:1.6;">
        Hi <strong>${booking.name}</strong>, your meeting has been successfully scheduled! Here are the details:
      </p>
      ${detailRow(icons.event, 'Event', eventName)}
      ${detailRow(icons.calendar, 'Date', dateStr)}
      ${detailRow(icons.clock, 'Time', `${startStr} – ${endStr} IST (${duration} min)`)}
      ${locationRowHTML}
      ${calendarButtons}
      <div style="margin-top:16px;padding:16px;background:#f0fdf4;border-radius:12px;border:1px solid #bbf7d0;">
        <p style="margin:0;font-size:13px;color:#166534;font-weight:500;">
          ✅ You'll receive a reminder 30 minutes before your meeting.
        </p>
      </div>`;

    const inviteeHTML = buildEmailHTML({
      heading: '🎉 Meeting Confirmed!',
      preheader: `Your ${eventName} on ${dateStr} at ${startStr} is confirmed.`,
      bodyHTML: inviteeBody,
    });

    // ── Email to HOST ──
    const hostBody = `
      <p style="font-size:15px;color:#374151;margin:0 0 20px;line-height:1.6;">
        You have a new booking! Here are the details:
      </p>
      ${detailRow(icons.user, 'Invitee', booking.name)}
      ${detailRow(icons.mail, 'Invitee Email', booking.email)}
      ${detailRow(icons.event, 'Event', eventName)}
      ${detailRow(icons.calendar, 'Date', dateStr)}
      ${detailRow(icons.clock, 'Time', `${startStr} – ${endStr} IST (${duration} min)`)}
      ${locationRowHTML}
      ${calendarButtons}`;

    const hostHTML = buildEmailHTML({
      heading: '📅 New Booking Received',
      preheader: `${booking.name} booked ${eventName} on ${dateStr} at ${startStr}.`,
      bodyHTML: hostBody,
    });

    try {
      // Send both emails concurrently
      await Promise.all([
        transport.sendMail({
          from: `"Calendly Clone" <${process.env.SMTP_USER}>`,
          to: booking.email,
          subject: `✅ Booking Confirmed: ${eventName} on ${dateStr}`,
          html: inviteeHTML,
        }),
        transport.sendMail({
          from: `"Calendly Clone" <${process.env.SMTP_USER}>`,
          to: hostEmail,
          subject: `📅 New Booking: ${booking.name} — ${eventName}`,
          html: hostHTML,
        }),
      ]);
      console.log(`📧 Confirmation emails sent for booking #${booking.id}`);
    } catch (err) {
      console.error('❌ Failed to send confirmation email:', err.message);
      // Don't throw — email failure should not break the booking flow
    }
  },

  /**
   * Send a 30-minute reminder email to the invitee.
   *
   * @param {object} booking - Booking record (with eventType included)
   */
  async sendReminder(booking) {
    const transport = getTransporter();
    if (!transport) return;

    const eventName = booking.eventType?.name || 'Meeting';
    const dateStr = formatDate(booking.startTime);
    const startStr = formatTime(booking.startTime);
    const endStr = formatTime(booking.endTime);

    const bodyHTML = `
      <p style="font-size:15px;color:#374151;margin:0 0 20px;line-height:1.6;">
        Hi <strong>${booking.name}</strong>, just a friendly reminder — your meeting starts in <strong>30 minutes</strong>!
      </p>
      ${detailRow(icons.event, 'Event', eventName)}
      ${detailRow(icons.calendar, 'Date', dateStr)}
      ${detailRow(icons.clock, 'Time', `${startStr} – ${endStr} IST`)}
      <div style="margin-top:24px;padding:16px;background:#fffbeb;border-radius:12px;border:1px solid #fde68a;">
        <p style="margin:0;font-size:13px;color:#92400e;font-weight:500;">
          ⏰ Your meeting starts at ${startStr}. Please be ready!
        </p>
      </div>`;

    const html = buildEmailHTML({
      heading: '⏰ Meeting in 30 Minutes!',
      preheader: `Reminder: ${eventName} starts at ${startStr} today.`,
      bodyHTML: bodyHTML,
      accentColor: '#FF8C00',
    });

    try {
      await transport.sendMail({
        from: `"Calendly Clone" <${process.env.SMTP_USER}>`,
        to: booking.email,
        subject: `⏰ Reminder: ${eventName} starts in 30 minutes`,
        html,
      });
      console.log(`🔔 Reminder email sent for booking #${booking.id} to ${booking.email}`);
    } catch (err) {
      console.error(`❌ Failed to send reminder for booking #${booking.id}:`, err.message);
    }
  },

  /**
   * Send a reminder email to the HOST 30 min before the meeting.
   */
  async sendHostReminder(booking, hostEmail) {
    const transport = getTransporter();
    if (!transport) return;

    const eventName = booking.eventType?.name || 'Meeting';
    const startStr = formatTime(booking.startTime);
    const endStr = formatTime(booking.endTime);

    const bodyHTML = `
      <p style="font-size:15px;color:#374151;margin:0 0 20px;line-height:1.6;">
        Your meeting with <strong>${booking.name}</strong> starts in <strong>30 minutes</strong>!
      </p>
      ${detailRow(icons.user, 'Invitee', booking.name)}
      ${detailRow(icons.mail, 'Invitee Email', booking.email)}
      ${detailRow(icons.event, 'Event', eventName)}
      ${detailRow(icons.clock, 'Time', `${startStr} – ${endStr} IST`)}`;

    const html = buildEmailHTML({
      heading: '⏰ Meeting in 30 Minutes!',
      preheader: `Reminder: ${booking.name} — ${eventName} at ${startStr}.`,
      bodyHTML: bodyHTML,
      accentColor: '#FF8C00',
    });

    try {
      await transport.sendMail({
        from: `"Calendly Clone" <${process.env.SMTP_USER}>`,
        to: hostEmail,
        subject: `⏰ Reminder: ${booking.name} — ${eventName} in 30 min`,
        html,
      });
      console.log(`🔔 Host reminder sent for booking #${booking.id}`);
    } catch (err) {
      console.error(`❌ Failed to send host reminder for booking #${booking.id}:`, err.message);
    }
  },
  /**
   * Send an invitation email to a co-host when they're added to an event.
   *
   * @param {object} params
   * @param {string} params.coHostEmail - Co-host email
   * @param {string} params.coHostName - Co-host name
   * @param {string} params.eventName - Event type name
   * @param {string} params.eventKind - 'round-robin' or 'collective'
   * @param {number} params.duration - Event duration in minutes
   * @param {string} params.hostName - Creator/host name
   * @param {string} params.slug - Event slug for linking
   */
  async sendCoHostInvitation({ coHostEmail, coHostName, eventName, eventKind, duration, hostName, slug }) {
    const transport = getTransporter();
    if (!transport) return;

    const kindLabel = eventKind === 'round-robin' ? 'Round Robin' : 'Collective';
    const kindDesc = eventKind === 'round-robin'
      ? 'Meetings will be distributed between you and other hosts in rotation.'
      : 'You will join all meetings together with the other hosts.';

    const frontendUrl = 'https://calendly-clone-front-end.vercel.app';

    const bodyHTML = `
      <p style="font-size:15px;color:#374151;margin:0 0 20px;line-height:1.6;">
        Hi <strong>${coHostName || 'there'}</strong>, you've been added as a co-host!
      </p>
      ${detailRow(icons.event, 'Event', eventName)}
      ${detailRow(icons.clock, 'Duration', `${duration} minutes`)}
      ${detailRow(icons.user, 'Added by', hostName)}
      <div style="margin-top:20px;padding:16px;background:#f5f3ff;border-radius:12px;border:1px solid #ddd6fe;">
        <p style="margin:0 0 4px;font-size:13px;color:#5b21b6;font-weight:600;">
          ${kindLabel} Event
        </p>
        <p style="margin:0;font-size:13px;color:#6d28d9;">
          ${kindDesc}
        </p>
      </div>
      <div style="margin-top:24px;text-align:center;">
        <a href="${frontendUrl}/meetings" style="display:inline-block;padding:12px 28px;background:#006BFF;color:#ffffff;text-decoration:none;border-radius:10px;font-size:14px;font-weight:600;">
          View Your Meetings
        </a>
      </div>`;

    const html = buildEmailHTML({
      heading: '🤝 You\'ve been added as a Co-Host!',
      preheader: `${hostName} added you as a co-host for "${eventName}".`,
      bodyHTML: bodyHTML,
      accentColor: '#7C3AED',
    });

    try {
      await transport.sendMail({
        from: `"Calendly Clone" <${process.env.SMTP_USER}>`,
        to: coHostEmail,
        subject: `🤝 Co-Host Invitation: ${eventName}`,
        html,
      });
      console.log(`📧 Co-host invitation sent to ${coHostEmail} for "${eventName}"`);
    } catch (err) {
      console.error(`❌ Failed to send co-host invitation to ${coHostEmail}:`, err.message);
    }
  },

  /**
   * Send a location update email when the host changes the meeting location.
   */
  async sendLocationUpdate({ recipientEmail, recipientName, eventName, locationType, locationValue, hostName }) {
    const transport = getTransporter();
    if (!transport) return;

    const locationLabels = {
      'google-meet': 'Google Meet',
      'teams': 'Microsoft Teams',
      'zoom': 'Zoom',
      'custom': 'In-Person / Custom',
      'none': 'No location',
    };
    const locationLabel = locationLabels[locationType] || locationType;

    const isLink = locationType !== 'custom' && locationType !== 'none' && locationValue;
    const locationDisplay = isLink
      ? `<a href="${locationValue}" style="color:#006BFF;text-decoration:none;font-weight:500;">${locationValue}</a>`
      : (locationValue || 'Not specified');

    const bodyHTML = `
      <p style="font-size:15px;color:#374151;margin:0 0 20px;line-height:1.6;">
        Hi <strong>${recipientName || 'there'}</strong>, the meeting location has been updated.
      </p>
      ${detailRow(icons.event, 'Event', eventName)}
      ${detailRow(icons.user, 'Updated by', hostName)}
      <div style="margin-top:20px;padding:16px;background:#eff6ff;border-radius:12px;border:1px solid #bfdbfe;">
        <p style="margin:0 0 4px;font-size:12px;color:#1d4ed8;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">
          New Location — ${locationLabel}
        </p>
        <p style="margin:0;font-size:15px;color:#1e40af;word-break:break-all;">
          ${locationDisplay}
        </p>
      </div>
      ${isLink ? `
      <div style="margin-top:24px;text-align:center;">
        <a href="${locationValue}" target="_blank" style="display:inline-block;padding:12px 28px;background:#006BFF;color:#ffffff;text-decoration:none;border-radius:10px;font-size:14px;font-weight:600;">
          Open Meeting Link
        </a>
      </div>` : ''}`;

    const html = buildEmailHTML({
      heading: '📍 Meeting Location Updated',
      preheader: `The location for "${eventName}" has been changed to ${locationLabel}.`,
      bodyHTML: bodyHTML,
      accentColor: '#2563EB',
    });

    try {
      await transport.sendMail({
        from: `"Calendly Clone" <${process.env.SMTP_USER}>`,
        to: recipientEmail,
        subject: `📍 Location Updated: ${eventName}`,
        html,
      });
      console.log(`📧 Location update sent to ${recipientEmail} for "${eventName}"`);
    } catch (err) {
      console.error(`❌ Failed to send location update to ${recipientEmail}:`, err.message);
    }
  },
};

module.exports = emailService;
