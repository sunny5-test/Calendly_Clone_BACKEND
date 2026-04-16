const {
  parse,
  format,
  addMinutes,
  startOfDay,
  endOfDay,
  isBefore,
  isAfter,
  getDay,
  setHours,
  setMinutes,
  setSeconds,
  setMilliseconds,
} = require('date-fns');
const { toZonedTime, fromZonedTime } = require('date-fns-tz');

/**
 * Parse a time string "HH:mm" into hours and minutes.
 * @param {string} timeStr - e.g. "09:00"
 * @returns {{ hours: number, minutes: number }}
 */
function parseTimeString(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return { hours, minutes };
}

/**
 * Set the time on a Date object from an "HH:mm" string.
 * @param {Date} date
 * @param {string} timeStr - e.g. "09:00"
 * @returns {Date}
 */
function setTimeOnDate(date, timeStr) {
  const { hours, minutes } = parseTimeString(timeStr);
  let result = new Date(date);
  result = setHours(result, hours);
  result = setMinutes(result, minutes);
  result = setSeconds(result, 0);
  result = setMilliseconds(result, 0);
  return result;
}

/**
 * Generate time slots for a given date based on availability and event duration.
 *
 * Algorithm:
 * 1. Get availability for the target day's dayOfWeek
 * 2. Generate candidate slots from startTime to endTime in `duration`-minute increments
 * 3. Filter out slots that overlap with existing bookings
 * 4. Filter out slots in the past (if date is today)
 *
 * @param {string} dateStr - "YYYY-MM-DD"
 * @param {number} duration - event duration in minutes
 * @param {{ startTime: string, endTime: string, timezone: string }} availability
 * @param {Array<{ startTime: Date, endTime: Date }>} existingBookings
 * @returns {Array<{ start: string, end: string }>} available slots as ISO strings
 */
function generateTimeSlots(dateStr, duration, availability, existingBookings) {
  if (!availability) return [];

  const timezone = availability.timezone || 'Asia/Kolkata';

  // Parse the date string and set availability window boundaries
  const baseDate = new Date(dateStr + 'T00:00:00');
  const windowStart = setTimeOnDate(baseDate, availability.startTime);
  const windowEnd = setTimeOnDate(baseDate, availability.endTime);

  // Convert window boundaries to UTC using the availability timezone
  const windowStartUTC = fromZonedTime(windowStart, timezone);
  const windowEndUTC = fromZonedTime(windowEnd, timezone);

  const now = new Date();
  const slots = [];
  let current = new Date(windowStartUTC);

  while (true) {
    const slotEnd = addMinutes(current, duration);

    // Stop if slot would exceed the availability window
    if (isAfter(slotEnd, windowEndUTC)) break;

    // Skip slots in the past
    if (!isBefore(current, now)) {
      // Check for overlaps with existing bookings
      const hasConflict = existingBookings.some((booking) => {
        const bookingStart = new Date(booking.startTime);
        const bookingEnd = new Date(booking.endTime);
        return isBefore(current, bookingEnd) && isAfter(slotEnd, bookingStart);
      });

      if (!hasConflict) {
        slots.push({
          start: current.toISOString(),
          end: slotEnd.toISOString(),
        });
      }
    }

    current = addMinutes(current, duration);
  }

  return slots;
}

module.exports = {
  parseTimeString,
  setTimeOnDate,
  generateTimeSlots,
};
