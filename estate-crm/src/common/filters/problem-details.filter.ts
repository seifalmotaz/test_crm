import {
  ArgumentsHost,
  BadRequestException,
  Catch,
} from '@nestjs/common';
import {
  ProblemDetailFilter,
  ProblemDetailException,
  ProblemDetailTypeUrlResolver,
} from '@sjfrhafe/nest-problem-details';
import { AppError } from '../errors/app-error';
import { ErrorCodes } from '../errors/error-codes';

/**
 * Custom type URL resolver for our domain error codes.
 */
const typeUrlResolver: ProblemDetailTypeUrlResolver = (code: number, title: string) => {
  return `https://httpstatuses.com/${code}`;
};

/**
 * Extended Problem Detail filter that handles:
 * - AppError → full custom fields (code, i18nKey, fieldErrors)
 * - BadRequestException (ValidationPipe) → RFC 7807 with VALIDATION_ERROR code
 * - Everything else → delegated to ProblemDetailFilter
 *
 * Per ADR-0008, every error response includes a machine-readable error code.
 */
@Catch()
export class EstateCrmProblemDetailFilter extends ProblemDetailFilter {
  constructor() {
    super(typeUrlResolver);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    // Handle our custom AppError with full custom fields
    if (exception instanceof AppError) {
      return this.handleAppError(exception, host);
    }

    // Handle ValidationPipe BadRequestException with our error code
    if (exception instanceof BadRequestException) {
      return this.handleBadRequest(exception, host);
    }

    // Delegate everything else to the library's filter
    return super.catch(exception as Error, host);
  }

  private handleAppError(e: AppError, host: ArgumentsHost): void {
    const response = e.getResponse() as Record<string, unknown>;

    const problem: Record<string, unknown> = {
      ...response,
      status: e.getStatus(),
      instance: host.switchToHttp().getRequest().url,
    };

    // Include fieldErrors from ValidationError if present
    if ((e as any).fieldErrors) {
      problem.fieldErrors = (e as any).fieldErrors;
    }

    host
      .switchToHttp()
      .getResponse()
      .status(e.getStatus())
      .header('Content-Type', 'application/problem+json')
      .send(problem);
  }

  private handleBadRequest(e: BadRequestException, host: ArgumentsHost): void {
    const response = e.getResponse() as Record<string, unknown>;
    const messages = Array.isArray(response.message)
      ? response.message as string[]
      : [e.message];

    // Build fieldErrors from validation messages
    const fieldErrors: Record<string, string[]> = {};
    for (const msg of messages) {
      const field = msg.split(' ')[0];
      if (field && !field.includes(' ')) {
        if (!fieldErrors[field]) fieldErrors[field] = [];
        fieldErrors[field].push(msg);
      }
    }

    const problem: Record<string, unknown> = {
      type: `https://httpstatuses.com/400`,
      title: 'Bad Request',
      status: 400,
      code: ErrorCodes.VALIDATION_ERROR,
      detail: messages.length === 1 ? messages[0] : 'Validation failed',
      instance: host.switchToHttp().getRequest().url,
    };

    if (Object.keys(fieldErrors).length > 0) {
      problem.fieldErrors = fieldErrors;
    }

    host
      .switchToHttp()
      .getResponse()
      .status(400)
      .header('Content-Type', 'application/problem+json')
      .send(problem);
  }
}
