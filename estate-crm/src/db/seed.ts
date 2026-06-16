import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { superAdmins, organizations, users, commissionPlans, projects, properties, leads, leadTags, activities } from './schema';
import { eq, and } from 'drizzle-orm';
import * as argon2 from 'argon2';

async function main() {
  const connectionString = process.env.DATABASE_URL!;
  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);

  console.log('Seeding database...');

  // ── Super Admin ──
  let superAdmin = await db
    .select()
    .from(superAdmins)
    .where(eq(superAdmins.email, 'super@admin.com'))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!superAdmin) {
    const saHash = await argon2.hash('super123!', {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
    [superAdmin] = await db.insert(superAdmins).values({
      email: 'super@admin.com',
      passwordHash: saHash,
      name: 'Super Admin',
    }).returning();
    console.log(`Created super admin: ${superAdmin.email} (${superAdmin.id})`);
  } else {
    console.log(`Super admin already exists: ${superAdmin.email} (${superAdmin.id})`);
  }

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
  const createdAgentIds: string[] = [];

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
        name: `Test Agent ${createdAgentIds.length + 1}`,
        role: 'agent',
        status: 'active',
        commissionSplit: createdAgentIds.length === 0 ? '0.6000' : '0.6500',
      }).returning();
      createdAgentIds.push(created.id);
    } else {
      createdAgentIds.push(agent.id);
    }
  }

  console.log(`Agents: ${agentEmails.join(', ')}`);

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

  // ── Seed Projects ──
  const projectNames = ['Sunset Residences', 'Marina Heights', 'Palm Vista', 'Green Valley', 'Skyline Penthouse', 'Harbor View'];
  const createdProjectIds: string[] = [];

  for (const name of projectNames) {
    const slug = name.toLowerCase().replace(/\s+/g, '-');
    const existing = await db
      .select()
      .from(projects)
      .where(eq(projects.tenantId, org.id))
      .then((rows) => rows.find((p) => p.name === name));

    if (!existing) {
      const [created] = await db.insert(projects).values({
        tenantId: org.id,
        name,
        location: `${name} Blvd, Downtown`,
        developerName: 'Triple Shield Development',
        status: 'planning',
        launchDate: new Date('2025-03-01'),
        completionDate: new Date('2026-12-01'),
        totalUnits: 100 + Math.floor(Math.random() * 200),
        soldUnits: 0,
      }).returning();
      createdProjectIds.push(created.id);
      console.log(`Created project: ${created.name} (${created.id})`);
    } else {
      createdProjectIds.push(existing.id);
      console.log(`Project already exists: ${existing.name} (${existing.id})`);
    }
  }

  // ── Seed Properties ──
  type PropertySeed = {
    title: string;
    address: string;
    type: 'apartment' | 'villa' | 'commercial' | 'land' | 'townhouse';
    price: number;
    beds?: number;
    baths?: number;
    sqft?: number;
    yearBuilt?: number;
    projectIdx?: number;
    attributes?: Record<string, unknown>;
  };

  const propertySeeds: PropertySeed[] = [
    {
      title: '245 Marina Heights #12B',
      address: '245 Marina Heights Dr, Downtown',
      type: 'apartment',
      price: 245000000,
      beds: 3,
      baths: 2,
      sqft: 1800,
      yearBuilt: 2022,
      projectIdx: 1,
      attributes: {
        floor: 12,
        totalFloors: 24,
        hasElevator: true,
        maintenanceFee: 85000,
        amenities: ['Pool', 'Gym', 'Concierge'],
        parkingSpots: 1,
      },
    },
    {
      title: '18 Palm Villa',
      address: '18 Palm Vista Lane, North Hills',
      type: 'villa',
      price: 180000000,
      beds: 5,
      baths: 4,
      sqft: 4200,
      yearBuilt: 2021,
      projectIdx: 2,
      attributes: {
        plotSize: 6000,
        gardenArea: 1500,
        floors: 2,
        hasPool: true,
        hasGarden: true,
        parkingSpots: 3,
      },
    },
    {
      title: '92 Skyline Penthouse',
      address: '92 Skyline Ave, Midtown',
      type: 'apartment',
      price: 520000000,
      beds: 4,
      baths: 4,
      sqft: 3500,
      yearBuilt: 2023,
      projectIdx: 4,
      attributes: {
        floor: 45,
        totalFloors: 45,
        hasElevator: true,
        maintenanceFee: 150000,
        amenities: ['Private Pool', 'Rooftop Terrace', '24h Security'],
        parkingSpots: 3,
      },
    },
    {
      title: '7 Green Valley Villa',
      address: '7 Green Valley Rd, Westside',
      type: 'villa',
      price: 98000000,
      beds: 4,
      baths: 3,
      sqft: 3100,
      yearBuilt: 2020,
      projectIdx: 3,
      attributes: {
        plotSize: 4500,
        gardenArea: 1200,
        floors: 2,
        hasPool: true,
        hasGarden: true,
        parkingSpots: 2,
      },
    },
    {
      title: 'Harbor View Office #402',
      address: 'Harbor View Tower, 400 Commerce St',
      type: 'commercial',
      price: 340000000,
      sqft: 2800,
      yearBuilt: 2021,
      projectIdx: 5,
      attributes: {
        frontage: 40,
        ceilingHeight: 3.5,
        licenseType: 'Office',
        footTraffic: 'high',
        utilities: ['Fiber', 'HVAC', 'Backup Power'],
      },
    },
    {
      title: 'Plot 15 North Hills',
      address: '15 North Hills Estate, Plot 15',
      type: 'land',
      price: 125000000,
      sqft: 10000,
      projectIdx: undefined,
      attributes: {
        zoningType: 'Residential',
        buildableArea: 8000,
        roadAccess: true,
        utilitiesAvailable: ['Water', 'Electricity', 'Sewer'],
        topography: 'flat',
      },
    },
    {
      title: 'Townhouse 8B Sunset Residences',
      address: '8B Sunset Residences, Downtown',
      type: 'townhouse',
      price: 89000000,
      beds: 3,
      baths: 2,
      sqft: 1650,
      yearBuilt: 2022,
      projectIdx: 0,
      attributes: {
        plotSize: 2200,
        sharedWalls: 1,
        floors: 2,
        hasGarden: true,
        parkingSpots: 1,
      },
    },
    {
      title: '33 Midtown Condo',
      address: '33 Midtown Circle, Apt 5C',
      type: 'apartment',
      price: 135000000,
      beds: 2,
      baths: 1,
      sqft: 950,
      yearBuilt: 2021,
      projectIdx: 4,
      attributes: {
        floor: 5,
        totalFloors: 18,
        hasElevator: true,
        maintenanceFee: 45000,
        amenities: ['Gym', 'Rooftop'],
        parkingSpots: 1,
      },
    },
  ];

  for (const seed of propertySeeds) {
    const existing = await db
      .select()
      .from(properties)
      .where(eq(properties.tenantId, org.id))
      .then((rows) => rows.find((p) => p.title === seed.title && p.address === seed.address));

    if (!existing) {
      const [created] = await db.insert(properties).values({
        tenantId: org.id,
        projectId: seed.projectIdx !== undefined ? createdProjectIds[seed.projectIdx] : null,
        title: seed.title,
        address: seed.address,
        type: seed.type,
        status: 'active',
        price: seed.price,
        beds: seed.beds ?? null,
        baths: seed.baths ?? null,
        sqft: seed.sqft ?? null,
        yearBuilt: seed.yearBuilt ?? null,
        attributes: seed.attributes ?? {},
        images: [],
        videos: [],
        tags: seed.type === 'villa' ? ['Luxury', 'Pool'] : seed.type === 'apartment' ? ['City View'] : [],
        agentId: createdAgentIds.length > 0 ? createdAgentIds[0] : null,
      }).returning();
      console.log(`Created property: ${created.title} ($${created.price / 100})`);
    } else {
      console.log(`Property already exists: ${existing.title}`);
    }
  }

  // ── Seed Leads ──
  const leadNames = [
    'Ahmed Hassan', 'Fatima Ali', 'Mohamed Saeed', 'Layla Ibrahim',
    'Omar Khaled', 'Nour El-Din', 'Yasmin Adel', 'Karim Farouk',
    'Hala Mostafa', 'Tamer Nabil', 'Rana Saleh', 'Hisham Gamal',
  ];
  const sources = ['website', 'referral', 'social_media', 'walk_in', 'portal', 'cold_call'];
  const leadTypes = ['buyer', 'seller', 'investor', 'renter'];
  const leadStages = ['fresh', 'qualified', 'followUp', 'reservation', 'lost'];

  for (let i = 0; i < leadNames.length; i++) {
    const stage = leadStages[i % leadStages.length];
    const agentIdx = i % createdAgentIds.length;
    const email = `lead${i}@example.com`;

    const existing = await db
      .select()
      .from(leads)
      .where(eq(leads.tenantId, org.id))
      .then((rows) => rows.find((l) => l.email === email));

    if (!existing) {
      const [created] = await db.insert(leads).values({
        tenantId: org.id,
        name: leadNames[i],
        email,
        phone: `+20100${String(1000000 + i).padStart(7, '0')}`,
        source: sources[i % sources.length],
        type: leadTypes[i % leadTypes.length],
        budgetMin: 10000000 + i * 1000000,
        budgetMax: 30000000 + i * 2000000,
        timeline: [1, 3, 6, 12][i % 4],
        preferredLocation: ['New Cairo', '6th October', 'North Coast', 'Heliopolis'][i % 4],
        preferredType: leadTypes[i % leadTypes.length],
        stage: stage,
        score: 50 + (i * 7) % 50,
        agentId: createdAgentIds[agentIdx] ?? null,
        notes: `Lead ${i + 1} - interested in ${leadTypes[i % leadTypes.length]} opportunities`,
        nextAction: ['Call back', 'Send listings', 'Schedule viewing'][i % 3],
        nextActionDate: new Date(Date.now() + (i + 1) * 86400000),
        isClient: i === 11,
        isDnc: i === 10,
      }).returning();
      console.log(`Created lead: ${created.name} (stage: ${created.stage})`);

      // Add a tag
      if (i % 3 === 0) {
        await db.insert(leadTags).values({
          leadId: created.id,
          tag: 'Hot',
          color: '#EF4444',
        });
      } else if (i % 3 === 1) {
        await db.insert(leadTags).values({
          leadId: created.id,
          tag: 'Investor',
          color: '#10B981',
        });
      }

      // Add 1-2 activities
      await db.insert(activities).values({
        tenantId: org.id,
        entityType: 'lead',
        entityId: created.id,
        type: 'call',
        content: `Initial call with ${created.name}. Discussed requirements.`,
        agentId: createdAgentIds[agentIdx],
      });
      if (i % 2 === 0) {
        await db.insert(activities).values({
          tenantId: org.id,
          entityType: 'lead',
          entityId: created.id,
          type: 'note',
          content: 'Sent property listings matching budget.',
          agentId: createdAgentIds[agentIdx],
        });
      }
    } else {
      console.log(`Lead already exists: ${existing.name}`);
    }
  }

  console.log('Seed complete!');
  await client.end();
}


main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
