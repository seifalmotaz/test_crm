import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { organizations, users, commissionPlans } from './schema';
import { eq } from 'drizzle-orm';
import * as argon2 from 'argon2';

async function main() {
  const connectionString = process.env.DATABASE_URL!;
  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);

  console.log('Seeding database...');

  // ── Organization ──
  let org = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, 'test-brokerage'))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!org) {
    const [created] = await db.insert(organizations).values({
      name: 'Test Brokerage',
      slug: 'test-brokerage',
      status: 'active',
      plan: 'pro',
    }).returning();
    org = created;
    console.log(`Created organization: ${org.name} (${org.id})`);
  } else {
    console.log(`Organization already exists: ${org.name} (${org.id})`);
  }

  // ── Admin user ──
  let admin = await db
    .select()
    .from(users)
    .where(eq(users.email, 'admin@test.com'))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!admin) {
    const passwordHash = await argon2.hash('admin123!', {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
    [admin] = await db.insert(users).values({
      tenantId: org.id,
      email: 'admin@test.com',
      passwordHash,
      name: 'Test Admin',
      role: 'admin',
      status: 'active',
    }).returning();
    console.log(`Created admin user: ${admin.email} (${admin.id})`);
  } else {
    console.log(`Admin user already exists: ${admin.email} (${admin.id})`);
  }

  // ── Manager ──
  let manager = await db
    .select()
    .from(users)
    .where(eq(users.email, 'manager@test.com'))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!manager) {
    const managerHash = await argon2.hash('manager123!', {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
    [manager] = await db.insert(users).values({
      tenantId: org.id,
      email: 'manager@test.com',
      passwordHash: managerHash,
      name: 'Test Manager',
      role: 'manager',
      status: 'active',
    }).returning();
    console.log(`Created manager: ${manager.email} (${manager.id})`);
  } else {
    console.log(`Manager already exists: ${manager.email} (${manager.id})`);
  }

  // ── Agents ──
  const agentEmails = ['agent1@test.com', 'agent2@test.com'];
  const createdAgents: string[] = [];

  for (const email of agentEmails) {
    let agent = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (!agent) {
      const agentHash = await argon2.hash('agent123!', {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
      });
      const [created] = await db.insert(users).values({
        tenantId: org.id,
        email,
        passwordHash: agentHash,
        name: `Test Agent ${createdAgents.length + 1}`,
        role: 'agent',
        status: 'active',
        commissionSplit: createdAgents.length === 0 ? '0.6000' : '0.6500',
      }).returning();
      createdAgents.push(created.email);
    } else {
      createdAgents.push(agent.email);
    }
  }

  console.log(`Agents: ${createdAgents.join(', ')}`);

  // ── Default commission plan ──
  let plan = await db
    .select()
    .from(commissionPlans)
    .where(eq(commissionPlans.name, 'Standard 3%'))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!plan) {
    [plan] = await db.insert(commissionPlans).values({
      tenantId: org.id,
      name: 'Standard 3%',
      type: 'percentage',
      rate: '0.03',
      isDefault: true,
    }).returning();
    console.log(`Created commission plan: ${plan.name} (${plan.id})`);
  } else {
    console.log(`Commission plan already exists: ${plan.name} (${plan.id})`);
  }

  console.log('Seed complete!');
  await client.end();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
