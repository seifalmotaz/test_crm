import { AppError } from './app-error';
import { ErrorCodes } from './error-codes';

/**
 * Error thrown when a requested resource is not found.
 * Maps to HTTP 404 with NOT_FOUND code.
 */
export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', i18nKey?: string) {
    super(ErrorCodes.NOT_FOUND, 404, message, i18nKey);
    this.name = 'NotFoundError';
  }
}