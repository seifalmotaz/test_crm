import { AppError } from './app-error';
import { ErrorCodes } from './error-codes';

/**
 * Error thrown when request validation fails.
 * Maps to HTTP 400 with VALIDATION_ERROR code.
 * Optionally includes field-level error details.
 */
export class ValidationError extends AppError {
  public readonly fieldErrors?: Record<string, string[]>;

  constructor(
    message = 'Validation failed',
    fieldErrors?: Record<string, string[]>,
  ) {
    super(ErrorCodes.VALIDATION_ERROR, 400, message);
    this.name = 'ValidationError';
    this.fieldErrors = fieldErrors;
  }
}
