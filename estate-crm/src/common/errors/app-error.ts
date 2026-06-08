import { ProblemDetailException } from '@sjfrhafe/nest-problem-details';

/** HTTP status code to standard RFC 7807 title mapping */
const STATUS_TITLES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
};

/**
 * Base application error class.
 * Extends ProblemDetailException from @sjfrhafe/nest-problem-details.
 * Supports RFC 7807/9457 Problem Details serialization with custom error codes.
 */
export class AppError extends ProblemDetailException {
  public readonly code: string;
  public readonly i18nKey?: string;
  public readonly metadata?: Record<string, unknown>;

  constructor(
    code: string,
    status: number,
    message: string,
    i18nKey?: string,
    metadata?: Record<string, unknown>,
  ) {
    super(status, {
      type: `https://errors.estate-crm.com/${code.toLowerCase()}`,
      title: STATUS_TITLES[status] ?? 'Error',
      detail: message,
      code,
      ...(i18nKey ? { i18nKey } : {}),
    });
    this.name = 'AppError';
    this.code = code;
    this.i18nKey = i18nKey;
    this.metadata = metadata;
    // Ensure message is accessible (HttpException stores response, not detail)
    Object.defineProperty(this, 'message', {
      value: message,
      writable: true,
      enumerable: false,
      configurable: true,
    });
  }
}
