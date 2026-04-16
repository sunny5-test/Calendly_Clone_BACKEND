const prisma = require('../config/db');
const { BadRequestError } = require('../utils/errors');

/**
 * Service layer for Availability management.
 * All operations are scoped to the authenticated user.
 */
const availabilityService = {
  /**
   * Get all availability entries for the authenticated user.
   * @param {number} userId - The authenticated user's ID
   */
  async getAll(userId) {
    return prisma.availability.findMany({
      where: { userId },
      orderBy: { dayOfWeek: 'asc' },
    });
  },

  /**
   * Bulk set availability for the authenticated user.
   * Accepts an array of { dayOfWeek, startTime, endTime, timezone } objects.
   * Deletes existing entries then creates the new ones.
   *
   * @param {Array<{ dayOfWeek: number, startTime: string, endTime: string, timezone?: string }>} schedules
   * @param {number} userId - The authenticated user's ID
   */
  async setAvailability(schedules, userId) {
    if (!Array.isArray(schedules)) {
      throw new BadRequestError('Schedules must be an array');
    }

    // First, delete all existing availability for the user
    await prisma.availability.deleteMany({
      where: { userId },
    });

    // Then create new availability entries (only for enabled days)
    const creates = schedules
      .filter((s) => s.startTime && s.endTime) // skip disabled days
      .map((s) => ({
        dayOfWeek: parseInt(s.dayOfWeek),
        startTime: s.startTime,
        endTime: s.endTime,
        timezone: s.timezone || 'Asia/Kolkata',
        userId,
      }));

    if (creates.length > 0) {
      await prisma.availability.createMany({
        data: creates,
      });
    }

    // Return updated availability
    return prisma.availability.findMany({
      where: { userId },
      orderBy: { dayOfWeek: 'asc' },
    });
  },
};

module.exports = availabilityService;
