import { describe, it, expect } from 'vitest';

describe('UUID Utility', () => {
  it('should export uuidv7 function that generates a UUID v7 string', async () => {
    const { uuidv7 } = await import('@/common/utils/uuid');
    const id = uuidv7();

    expect(id).toBeDefined();
    expect(typeof id).toBe('string');
    // UUID v7 format: 8-4-4-4-12 hex chars
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('should generate unique values on each call', async () => {
    const { uuidv7 } = await import('@/common/utils/uuid');
    const ids = new Set(Array.from({ length: 100 }, () => uuidv7()));

    expect(ids.size).toBe(100);
  });

  it('should generate time-sortable UUIDs (monotonically increasing)', async () => {
    const { uuidv7 } = await import('@/common/utils/uuid');
    const ids = Array.from({ length: 100 }, () => uuidv7());

    for (let i = 1; i < ids.length; i++) {
      expect(ids[i] > ids[i - 1]).toBe(true);
    }
  });
});