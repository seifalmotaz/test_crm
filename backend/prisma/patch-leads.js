/**
 * One-time patch: set createdById = 'user_admin' for all leads that have null createdById.
 * Run once after `prisma db push`:  node prisma/patch-leads.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.lead.updateMany({
    where: { createdById: null, isDeleted: false },
    data:  { createdById: 'user_admin' },
  });
  console.log(`✓ Patched ${result.count} leads with createdById = 'user_admin'`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
