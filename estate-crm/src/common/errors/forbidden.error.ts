import { AppError } from './app-error';
import { ErrorCodes } from './error-codes';

/**
 * Error thrown when a user lacks permission for an action.
 * Maps to HTTP 403 with FORBIDDEN code.
 */
export class ForbiddenError extends AppError {
  constructor(message = 'Insufficient permissions', i18nKey?: string) {
    super(ErrorCodes.FORBIDDEN, 403, message, i18nKey);
    this.name = 'ForbiddenError';
  }
}