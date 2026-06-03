require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const email    = 'admin@propcrm.io';
  const password = 'Admin@1234';

  const hashed = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where:  { email },
    update: { password: hashed, isActive: true },
    create: { id: 'user_admin', email, password: hashed, role: 'admin', isActive: true },
  });

  console.log('✅ Admin credentials reset:');
  console.log('   Email   :', email);
  console.log('   Password:', password);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
