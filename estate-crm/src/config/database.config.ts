import { config } from './app.config';

/**
 * Database-specific configuration.
 * Derived from the validated app config.
 */
export const databaseConfig = {
  url: config.DATABASE_URL,
  urlTest: config.DATABASE_URL_TEST,
  maxConnections: 10,
} as const;
