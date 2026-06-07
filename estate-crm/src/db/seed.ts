import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { organizations, users, commissionPlans } from './schema';
import * as argon2 from 'argon2';

async function main() {
  const connectionString = process.env.DATABASE_URL!;
  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);

  // Seed data
  console.log('Seeding database...');

  // Create test organization
  const [org] = await db.insert(organizations).values({
    name: 'Test Brokerage',
    slug: 'test-brokerage',
    status: 'active',
    plan: 'pro',
  }).returning();

  console.log(`Created organization: ${org.name} (${org.id})`);

  // Create admin user
  const passwordHash = await argon2.hash('admin123!', {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const [admin] = await db.insert(users).values({
    tenantId: org.id,
    email: 'admin@test.com',
    passwordHash,
    name: 'Test Admin',
    role: 'admin',
    status: 'active',
  }).returning();

  console.log(`Created admin user: ${admin.email} (${admin.id})`);

  // Create manager
  const managerHash = await argon2.hash('manager123!', {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const [manager] = await db.insert(users).values({
    tenantId: org.id,
    email: 'manager@test.com',
    passwordHash: managerHash,
    name: 'Test Manager',
    role: 'manager',
    status: 'active',
  }).returning();

  console.log(`Created manager: ${manager.email} (${manager.id})`);

  // Create agents
  const agentHash = await argon2.hash('agent123!', {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const [agent1] = await db.insert(users).values({
    tenantId: org.id,
    email: 'agent1@test.com',
    passwordHash: agentHash,
    name: 'Test Agent 1',
    role: 'agent',
    status: 'active',
    commissionSplit: '0.6000',
  }).returning();

  const [agent2] = await db.insert(users).values({
    tenantId: org.id,
    email: 'agent2@test.com',
    passwordHash: agentHash,
    name: 'Test Agent 2',
    role: 'agent',
    status: 'active',
    commissionSplit: '0.6500',
  }).returning();

  console.log(`Created agents: ${agent1.email}, ${agent2.email}`);

  // Create default commission plan
  const [plan] = await db.insert(commissionPlans).values({
    tenantId: org.id,
    name: 'Standard 3%',
    type: 'percentage',
    rate: '0.03',
    isDefault: true,
  }).returning();

  console.log(`Created commission plan: ${plan.name} (${plan.id})`);

  console.log('Seed complete!');

  await client.end();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
