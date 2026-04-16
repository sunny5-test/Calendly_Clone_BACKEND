const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clean existing data
  await prisma.booking.deleteMany();
  await prisma.availability.deleteMany();
  await prisma.eventType.deleteMany();
  await prisma.user.deleteMany();

  // Create default admin user
  const user = await prisma.user.create({
    data: {
      name: 'Admin User',
      email: 'konda20006@gmail.com',
    },
  });
  console.log(`✅ Created user: ${user.name}`);

  // Create event types
  const eventType1 = await prisma.eventType.create({
    data: {
      name: '15 Minute Meeting',
      duration: 15,
      slug: '15-min-meeting',
      color: '#006BFF',
      userId: user.id,
    },
  });

  const eventType2 = await prisma.eventType.create({
    data: {
      name: '30 Minute Meeting',
      duration: 30,
      slug: '30-min-meeting',
      color: '#FF6B00',
      userId: user.id,
    },
  });

  const eventType3 = await prisma.eventType.create({
    data: {
      name: '60 Minute Meeting',
      duration: 60,
      slug: '60-min-meeting',
      color: '#00C853',
      userId: user.id,
    },
  });
  console.log(`✅ Created ${3} event types`);

  // Create weekly availability (Mon-Fri, 9:00-17:00 IST)
  const weekdays = [1, 2, 3, 4, 5]; // Monday to Friday
  for (const day of weekdays) {
    await prisma.availability.create({
      data: {
        dayOfWeek: day,
        startTime: '09:00',
        endTime: '17:00',
        timezone: 'Asia/Kolkata',
        userId: user.id,
      },
    });
  }
  console.log(`✅ Created availability for Mon-Fri (9:00-17:00)`);

  // Create sample bookings
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);

  const dayAfter = new Date(now);
  dayAfter.setDate(dayAfter.getDate() + 2);
  dayAfter.setHours(14, 0, 0, 0);

  const pastDate = new Date(now);
  pastDate.setDate(pastDate.getDate() - 2);
  pastDate.setHours(11, 0, 0, 0);

  await prisma.booking.create({
    data: {
      eventTypeId: eventType1.id,
      name: 'John Doe',
      email: 'john@example.com',
      startTime: tomorrow,
      endTime: new Date(tomorrow.getTime() + 15 * 60 * 1000),
      status: 'scheduled',
    },
  });

  await prisma.booking.create({
    data: {
      eventTypeId: eventType2.id,
      name: 'Jane Smith',
      email: 'jane@example.com',
      startTime: dayAfter,
      endTime: new Date(dayAfter.getTime() + 30 * 60 * 1000),
      status: 'scheduled',
    },
  });

  await prisma.booking.create({
    data: {
      eventTypeId: eventType2.id,
      name: 'Bob Wilson',
      email: 'bob@example.com',
      startTime: pastDate,
      endTime: new Date(pastDate.getTime() + 30 * 60 * 1000),
      status: 'scheduled',
    },
  });

  await prisma.booking.create({
    data: {
      eventTypeId: eventType3.id,
      name: 'Alice Brown',
      email: 'alice@example.com',
      startTime: new Date(pastDate.getTime() + 3 * 60 * 60 * 1000),
      endTime: new Date(pastDate.getTime() + 4 * 60 * 60 * 1000),
      status: 'cancelled',
    },
  });
  console.log(`✅ Created 4 sample bookings`);

  console.log('🎉 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
