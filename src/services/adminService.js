const prisma = require('../config/db');
const { NotFoundError, BadRequestError } = require('../utils/errors');

/**
 * Service layer for Admin operations.
 * Provides platform-wide data access for the admin dashboard.
 */
const adminService = {
  /**
   * Get aggregate platform statistics.
   */
  async getDashboardStats() {
    const now = new Date();

    const [
      totalUsers,
      totalEventTypes,
      totalBookings,
      upcomingBookings,
      cancelledBookings,
      pastBookings,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.eventType.count(),
      prisma.booking.count(),
      prisma.booking.count({
        where: { startTime: { gte: now }, status: 'scheduled' },
      }),
      prisma.booking.count({
        where: { status: 'cancelled' },
      }),
      prisma.booking.count({
        where: { startTime: { lt: now }, status: 'scheduled' },
      }),
    ]);

    // Recent bookings (last 7 days)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const recentBookings = await prisma.booking.count({
      where: { createdAt: { gte: sevenDaysAgo } },
    });

    // New users (last 7 days)
    const recentUsers = await prisma.user.count({
      where: { createdAt: { gte: sevenDaysAgo } },
    });

    return {
      totalUsers,
      totalEventTypes,
      totalBookings,
      upcomingBookings,
      cancelledBookings,
      pastBookings,
      recentBookings,
      recentUsers,
    };
  },

  /**
   * Get all users with their event type and booking counts.
   */
  async getAllUsers() {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            eventTypes: true,
            inviteeBookings: true,
          },
        },
      },
    });

    return users;
  },

  /**
   * Get all bookings across the platform with filters.
   * @param {string} type - 'upcoming' | 'past' | 'cancelled'
   */
  async getAllBookings(type = 'upcoming') {
    const now = new Date();

    let where = {};
    if (type === 'upcoming') {
      where = { startTime: { gte: now }, status: 'scheduled' };
    } else if (type === 'past') {
      where = { startTime: { lt: now }, status: 'scheduled' };
    } else if (type === 'cancelled') {
      where = { status: 'cancelled' };
    }

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        eventType: {
          include: {
            user: { select: { id: true, name: true, email: true, avatar: true } },
          },
        },
        invitee: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
      orderBy: { startTime: type === 'upcoming' ? 'asc' : 'desc' },
    });

    return bookings;
  },

  /**
   * Get all event types across the platform.
   */
  async getAllEventTypes() {
    const eventTypes = await prisma.eventType.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true, avatar: true } },
        _count: {
          select: { bookings: true },
        },
        coHosts: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    return eventTypes;
  },

  /**
   * Admin: Cancel any booking by ID.
   */
  async cancelBooking(id) {
    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(id) },
    });

    if (!booking) throw new NotFoundError('Booking not found');

    if (booking.status === 'cancelled') {
      throw new BadRequestError('Booking is already cancelled');
    }

    return prisma.booking.update({
      where: { id: parseInt(id) },
      data: { status: 'cancelled' },
      include: {
        eventType: {
          select: { name: true, duration: true },
        },
      },
    });
  },

  /**
   * Admin: Delete a user and all their associated data.
   * @param {number} id - User ID to delete
   * @param {number} adminUserId - The admin's own user ID (prevent self-delete)
   */
  async deleteUser(id, adminUserId) {
    const userId = parseInt(id);

    if (userId === adminUserId) {
      throw new BadRequestError('Admin cannot delete their own account');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) throw new NotFoundError('User not found');

    // Cascade delete handles event types, bookings, co-hosts, availability
    return prisma.user.delete({
      where: { id: userId },
    });
  },
};

module.exports = adminService;
