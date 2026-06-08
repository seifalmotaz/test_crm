import { config } from './app.config';

/**
 * Redis-specific configuration.
 * Derived from the validated app config.
 */
export const redisConfig = {
  url: config.REDIS_URL,
} as const;
