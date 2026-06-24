import { config } from './app.config';

/**
 * JWT-specific configuration.
 * Handles key loading and token settings.
 */
export const jwtConfig = {
  secret: config.JWT_SECRET,
  algorithm: 'HS256' as const,
  accessTokenExpiry: '7d',
  refreshTokenExpiry: 7 * 24 * 60 * 60, // 7 days in seconds
  cookieDomain: config.COOKIE_DOMAIN,
} as const;
