/**
 * Generates an RS256 key pair for JWT signing.
 * Prints to stdout in single-line PEM format suitable for .env files.
 *
 * Usage:
 *   bun run scripts/generate-jwt-keys.ts
 *
 * Output:
 *   JWT_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----
 *   JWT_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----
 */

const { generateKeyPairSync } = await import('crypto');

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem',
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem',
  },
});

const privateKeySingleLine = privateKey
  .split('\n')
  .filter((line) => line.length > 0)
  .join('\\n');

const publicKeySingleLine = publicKey
  .split('\n')
  .filter((line) => line.length > 0)
  .join('\\n');

console.log(`JWT_PRIVATE_KEY=${privateKeySingleLine}`);
console.log(`JWT_PUBLIC_KEY=${publicKeySingleLine}`);