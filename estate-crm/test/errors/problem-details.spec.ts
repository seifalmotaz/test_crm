import { describe, it, expect } from 'vitest';

// Helper to create a mock NestJS HTTP response that supports
// the .status().header().send() chain used by ProblemDetailFilter
function createMockResponse(captured: unknown[]) {
  const chain = {
    header: () => chain,
    send: (value: unknown) => { captured.push(value); },
    json: (value: unknown) => { captured.push(value); },
  };
  return {
    status: () => chain,
    header: () => chain,
  };
}

function createMockHost() {
  return {
    switchToHttp: () => ({
      getResponse: () => createMockResponse([]),
      getRequest: () => ({ url: '/api/test' }),
    }),
  };
}

describe('Error System', () => {
  describe('ErrorCodes', () => {
    it('should export all required error codes', async () => {
      const { ErrorCodes } = await import('@/common/errors/error-codes');
      expect(ErrorCodes).toBeDefined();
      expect(ErrorCodes.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
      expect(ErrorCodes.UNAUTHORIZED).toBe('UNAUTHORIZED');
      expect(ErrorCodes.FORBIDDEN).toBe('FORBIDDEN');
      expect(ErrorCodes.NOT_FOUND).toBe('NOT_FOUND');
      expect(ErrorCodes.CONFLICT).toBe('CONFLICT');
      expect(ErrorCodes.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
      expect(ErrorCodes.INVALID_CREDENTIALS).toBe('INVALID_CREDENTIALS');
      expect(ErrorCodes.TOKEN_EXPIRED).toBe('TOKEN_EXPIRED');
      expect(ErrorCodes.TENANT_SUSPENDED).toBe('TENANT_SUSPENDED');
      expect(ErrorCodes.TENANT_NOT_FOUND).toBe('TENANT_NOT_FOUND');
    });
  });

  describe('AppError', () => {
    it('should create an error with code, status, and message', async () => {
      const { AppError } = await import('@/common/errors/app-error');
      const error = new AppError('TEST_ERROR', 400, 'Something went wrong');

      expect(error).toBeInstanceOf(Error);
      expect(error.code).toBe('TEST_ERROR');
      expect(error.getStatus()).toBe(400);
      expect(error.message).toBe('Something went wrong');
      expect(error.name).toBe('AppError');
    });

    it('should include RFC 7807 fields in getResponse()', async () => {
      const { AppError } = await import('@/common/errors/app-error');
      const error = new AppError('TEST_ERROR', 400, 'Something went wrong');

      const response = error.getResponse() as Record<string, unknown>;
      expect(response).toHaveProperty('type');
      expect(response).toHaveProperty('title');
      expect(response).toHaveProperty('code', 'TEST_ERROR');
      expect(response).toHaveProperty('detail', 'Something went wrong');
    });
  });

  describe('NotFoundError', () => {
    it('should create a 404 error with NOT_FOUND code', async () => {
      const { NotFoundError } = await import('@/common/errors/not-found.error');
      const error = new NotFoundError('User not found');

      expect(error).toBeInstanceOf(Error);
      expect(error.code).toBe('NOT_FOUND');
      expect(error.getStatus()).toBe(404);
      expect(error.message).toBe('User not found');
    });
  });

  describe('ValidationError', () => {
    it('should create a 400 error with VALIDATION_ERROR code', async () => {
      const { ValidationError } = await import('@/common/errors/validation.error');
      const error = new ValidationError('Invalid input');

      expect(error).toBeInstanceOf(Error);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.getStatus()).toBe(400);
      expect(error.message).toBe('Invalid input');
    });

    it('should accept optional field errors', async () => {
      const { ValidationError } = await import('@/common/errors/validation.error');
      const fieldErrors = { email: ['Invalid email format'], name: ['Required'] };
      const error = new ValidationError('Invalid input', fieldErrors);

      expect(error.fieldErrors).toEqual(fieldErrors);
    });
  });

  describe('ForbiddenError', () => {
    it('should create a 403 error with FORBIDDEN code', async () => {
      const { ForbiddenError } = await import('@/common/errors/forbidden.error');
      const error = new ForbiddenError('Insufficient permissions');

      expect(error).toBeInstanceOf(Error);
      expect(error.code).toBe('FORBIDDEN');
      expect(error.getStatus()).toBe(403);
      expect(error.message).toBe('Insufficient permissions');
    });
  });

  describe('EstateCrmProblemDetailFilter', () => {
    it('should transform AppError to RFC 7807 response with code', async () => {
      const {
        EstateCrmProblemDetailFilter,
      } = await import('@/common/filters/problem-details.filter');
      const { AppError } = await import('@/common/errors/app-error');

      const filter = new EstateCrmProblemDetailFilter();
      const error = new AppError('TEST_ERROR', 400, 'Something went wrong');

      const capturedJson: unknown[] = [];
      const mockHost = {
        switchToHttp: () => ({
          getResponse: () => createMockResponse(capturedJson),
          getRequest: () => ({ url: '/api/test' }),
        }),
      };

      await filter.catch(error, mockHost as any);
      expect(capturedJson).toHaveLength(1);
      const result = capturedJson[0] as Record<string, unknown>;
      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('status', 400);
      expect(result).toHaveProperty('code', 'TEST_ERROR');
      expect(result).toHaveProperty('detail', 'Something went wrong');
    });

    it('should transform generic Error to 500 internal error', async () => {
      const {
        EstateCrmProblemDetailFilter,
      } = await import('@/common/filters/problem-details.filter');

      const filter = new EstateCrmProblemDetailFilter();
      const error = new Error('Unexpected crash');

      const capturedJson: unknown[] = [];
      const mockHost = {
        switchToHttp: () => ({
          getResponse: () => createMockResponse(capturedJson),
          getRequest: () => ({ url: '/api/test' }),
        }),
      };

      await filter.catch(error, mockHost as any);
      expect(capturedJson).toHaveLength(1);
      const result = capturedJson[0] as Record<string, unknown>;
      expect(result).toHaveProperty('status', 500);
      expect(result).toHaveProperty('detail', 'Unexpected crash');
    });

    it('should handle NestJS HttpException', async () => {
      const {
        EstateCrmProblemDetailFilter,
      } = await import('@/common/filters/problem-details.filter');
      const { HttpException } = await import('@nestjs/common');

      const filter = new EstateCrmProblemDetailFilter();
      const error = new HttpException('Not Found', 404);

      const capturedJson: unknown[] = [];
      const mockHost = {
        switchToHttp: () => ({
          getResponse: () => createMockResponse(capturedJson),
          getRequest: () => ({ url: '/api/test' }),
        }),
      };

      await filter.catch(error, mockHost as any);
      expect(capturedJson).toHaveLength(1);
      const result = capturedJson[0] as Record<string, unknown>;
      expect(result).toHaveProperty('status', 404);
      expect(result).toHaveProperty('detail', 'Not Found');
    });
  });
});

describe('Error System Integration', () => {
  it('should support instanceof checks for all error types', async () => {
    const { AppError } = await import('@/common/errors/app-error');
    const { NotFoundError } = await import('@/common/errors/not-found.error');
    const { ValidationError } = await import('@/common/errors/validation.error');
    const { ForbiddenError } = await import('@/common/errors/forbidden.error');

    const notFound = new NotFoundError('test');
    const validation = new ValidationError('test');
    const forbidden = new ForbiddenError('test');

    expect(notFound).toBeInstanceOf(AppError);
    expect(notFound).toBeInstanceOf(NotFoundError);
    expect(validation).toBeInstanceOf(AppError);
    expect(validation).toBeInstanceOf(ValidationError);
    expect(forbidden).toBeInstanceOf(AppError);
    expect(forbidden).toBeInstanceOf(ForbiddenError);
  });
});
