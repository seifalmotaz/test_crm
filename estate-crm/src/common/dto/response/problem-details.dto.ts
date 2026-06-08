import { ApiProperty } from '@nestjs/swagger';

/**
 * RFC 7807 Problem Details error response.
 * Returned by the EstateCrmProblemDetailFilter for all errors.
 */
export class ProblemDetailsDto {
  @ApiProperty({ example: 'https://errors.estate-crm.com/validation_error' })
  type: string;

  @ApiProperty({ example: 'Bad Request' })
  title: string;

  @ApiProperty({ example: 400 })
  status: number;

  @ApiProperty({ example: 'VALIDATION_ERROR' })
  code: string;

  @ApiProperty({ example: 'Validation failed' })
  detail: string;

  @ApiProperty({ example: '/api/auth/login' })
  instance: string;

  @ApiProperty({ required: false })
  i18nKey?: string;

  @ApiProperty({ required: false })
  fieldErrors?: Record<string, string[]>;
}
