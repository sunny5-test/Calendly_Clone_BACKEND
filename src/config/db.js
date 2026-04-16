const { PrismaClient } = require('@prisma/client');

/**
 * Singleton Prisma client instance.
 * Prevents multiple connections during hot-reloads in development.
 */

let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  if (!global.__prisma) {
    global.__prisma = new PrismaClient({
      log: ['warn', 'error'],
    });
  }
  prisma = global.__prisma;
}

module.exports = prisma;
