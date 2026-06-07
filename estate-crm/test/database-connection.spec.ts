import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';

// Set test database URL before any imports
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST ||
  'postgresql://estate_crm:estate_crm@localhost:5433/estate_crm_test';

describe('Database', () => {
  let db;

  beforeAll(async () => {
    // Dynamically import after setting env
    const { db: dbInstance } = await import('../src/db/connection');
    db = dbInstance;
  });

  it('should connect to PostgreSQL', async () => {
    const { sql } = await import('drizzle-orm');
    const result = await db.execute(sql`SELECT 1 as test`);
    expect(result[0].test).toBe(1);
  });

  it('should query organizations table', async () => {
    const { sql } = await import('drizzle-orm');
    const result = await db.execute(sql`SELECT COUNT(*) as count FROM organizations`);
    expect(Number(result[0].count)).toBeGreaterThanOrEqual(0);
  });
});

describe('Redis', () => {
  let redis;

  beforeAll(async () => {
    const { redis: redisInstance } = await import('../src/db/redis');
    redis = redisInstance;
  });

  afterAll(async () => {
    if (redis) {
      await redis.quit();
    }
  });

  it('should connect to Redis', async () => {
    await redis.set('test:connection', 'hello');
    const value = await redis.get('test:connection');
    expect(value).toBe('hello');
    await redis.del('test:connection');
  });

  it('should set and get with TTL', async () => {
    await redis.setex('test:ttl', 10, 'world');
    const ttl = await redis.ttl('test:ttl');
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(10);
    await redis.del('test:ttl');
  });
});
