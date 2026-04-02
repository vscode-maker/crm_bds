import { setup, checkSetupStatus } from './src/modules/auth/auth-service.js';
import { prisma } from './src/shared/database/prisma-client.js';

async function main() {
  try {
    const { needsSetup } = await checkSetupStatus();
    if (needsSetup) {
      console.log('No users found. Creating default admin...');
      await setup('ZaloCRM', 'Admin', 'admin@admin.com', '123456');
      console.log('Admin user created successfully.');
      console.log('Email: admin@admin.com');
      console.log('Password: 123456');
    } else {
      const users = await prisma.user.findMany({ take: 1, where: { role: 'owner' } });
      if (users.length > 0) {
         console.log('Admin user already exists.');
         console.log(`Email: ${users[0].email}`);
         console.log('Password: (bạn đã tạo lúc trước, hoặc 123456 nếu là default)');
      } else {
         console.log('No owner found but DB is not empty.');
      }
    }
  } catch(e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
