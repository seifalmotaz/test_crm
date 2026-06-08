import { describe, it, expect } from 'vitest';

describe('Password Utilities', () => {
  describe('hashPassword', () => {
    it('should hash a password using argon2id', async () => {
      const { hashPassword } = await import('@/common/utils/password');
      const hash = await hashPassword('MySecureP@ss1');

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      // argon2id hashes start with $argon2id$
      expect(hash.startsWith('$argon2id$')).toBe(true);
    });

    it('should produce different hashes for the same password (random salt)', async () => {
      const { hashPassword } = await import('@/common/utils/password');
      const hash1 = await hashPassword('SamePassword');
      const hash2 = await hashPassword('SamePassword');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyPassword', () => {
    it('should return true for correct password', async () => {
      const { hashPassword, verifyPassword } = await import('@/common/utils/password');
      const hash = await hashPassword('MySecureP@ss1');
      const result = await verifyPassword('MySecureP@ss1', hash);

      expect(result).toBe(true);
    });

    it('should return false for wrong password', async () => {
      const { hashPassword, verifyPassword } = await import('@/common/utils/password');
      const hash = await hashPassword('MySecureP@ss1');
      const result = await verifyPassword('WrongPassword', hash);

      expect(result).toBe(false);
    });
  });
});