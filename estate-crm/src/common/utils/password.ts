import * as argon2 from 'argon2';

/**
 * Hashes a plaintext password using argon2id.
 * Argon2id provides resistance against both side-channel
 * and GPU-based attacks.
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
}

/**
 * Verifies a plaintext password against an argon2id hash.
 * Returns true if the password matches, false otherwise.
 */
export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}