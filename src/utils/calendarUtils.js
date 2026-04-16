/**
 * Calendar utility — generates Google Calendar URLs and ICS file content
 * for adding meetings to external calendars.
 */

/**
 * Generate a Google Calendar event URL.
 *
 * @param {object} params
 * @param {string} params.title - Event title
 * @param {Date|string} params.startTime - Start time (ISO string or Date)
 * @param {Date|string} params.endTime - End time (ISO string or Date)
 * @param {string} [params.description] - Event description
 * @param {string} [params.location] - Event location (can be a URL)
 * @returns {string} Google Calendar URL
 */
function getGoogleCalendarUrl({ title, startTime, endTime, description, location }) {
  const start = formatGoogleDate(new Date(startTime));
  const end = formatGoogleDate(new Date(endTime));

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${start}/${end}`,
    details: description || '',
    location: location || '',
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Generate an Outlook Web calendar URL.
 */
function getOutlookCalendarUrl({ title, startTime, endTime, description, location }) {
  const start = new Date(startTime).toISOString();
  const end = new Date(endTime).toISOString();

  const params = new URLSearchParams({
    rru: 'addevent',
    subject: title,
    startdt: start,
    enddt: end,
    body: description || '',
    location: location || '',
    path: '/calendar/action/compose',
  });

  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

/**
 * Generate ICS (iCalendar) file content for download.
 *
 * @param {object} params
 * @param {string} params.title - Event title
 * @param {Date|string} params.startTime - Start time
 * @param {Date|string} params.endTime - End time
 * @param {string} [params.description] - Description
 * @param {string} [params.location] - Location
 * @param {string} [params.organizerEmail] - Organizer email
 * @param {string} [params.organizerName] - Organizer name
 * @returns {string} ICS file content
 */
function generateICS({ title, startTime, endTime, description, location, organizerEmail, organizerName }) {
  const start = formatICSDate(new Date(startTime));
  const end = formatICSDate(new Date(endTime));
  const now = formatICSDate(new Date());
  const uid = `booking-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@calendly-clone`;

  let ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Calendly Clone//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `DTSTAMP:${now}`,
    `UID:${uid}`,
    `SUMMARY:${escapeICS(title)}`,
  ];

  if (description) ics.push(`DESCRIPTION:${escapeICS(description)}`);
  if (location) ics.push(`LOCATION:${escapeICS(location)}`);
  if (organizerEmail) {
    const cn = organizerName ? `;CN=${escapeICS(organizerName)}` : '';
    ics.push(`ORGANIZER${cn}:mailto:${organizerEmail}`);
  }

  ics.push('STATUS:CONFIRMED', 'BEGIN:VALARM', 'TRIGGER:-PT30M', 'ACTION:DISPLAY', 'DESCRIPTION:Reminder', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR');

  return ics.join('\r\n');
}

// ─── Helpers ──────────────────────────────────────────────

/**
 * Format a Date as Google Calendar format: YYYYMMDDTHHmmssZ
 */
function formatGoogleDate(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * Format a Date as ICS format: YYYYMMDDTHHmmssZ
 */
function formatICSDate(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * Escape special characters for ICS format.
 */
function escapeICS(str) {
  return str.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

module.exports = {
  getGoogleCalendarUrl,
  getOutlookCalendarUrl,
  generateICS,
};
