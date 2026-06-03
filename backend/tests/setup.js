// Load env vars before any module is required (dotenv not loaded by app.js directly)
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Point to test DB; fall back to dev DB if DATABASE_URL_TEST is not configured
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;

const { prisma } = require('../src/config/database');

// Table names in dependency order — CASCADE handles FK order automatically
const TABLES = [
  'commission_adjustments',
  'commission_records',
  'deal_milestones',
  'deal_documents',
  'notifications',
  'files',
  'task_subtasks',
  'task_tags',
  'tasks',
  'deals',
  'lead_tags',
  'lead_interactions',
  'leads',
  'property_tags',
  'property_comps',
  'property_concerns',
  'properties',
  'client_tags',
  'client_transactions',
  'clients',
  'agents',
  'users',
  'audit_logs',
];

beforeAll(async () => {
  const tableList = TABLES.map(t => `"${t}"`).join(', ');
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`
  );
});
