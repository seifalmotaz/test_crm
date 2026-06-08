import { config } from './app.config';

/**
 * JWT-specific configuration.
 * Handles key loading and token settings.
 */
export const jwtConfig = {
  privateKey: config.JWT_PRIVATE_KEY,
  publicKey: config.JWT_PUBLIC_KEY,
  algorithm: 'RS256' as const,
  accessTokenExpiry: '15m',
  refreshTokenExpiry: 7 * 24 * 60 * 60, // 7 days in seconds
  cookieDomain: config.COOKIE_DOMAIN,
} as const;
