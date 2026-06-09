import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginatedMetaDto } from '@/common/dto/response/paginated-response.dto';

/**
 * User object returned by user endpoints (passwordHash excluded).
 */
export class UserResponseDto {
  @ApiProperty({ example: '01915d5e-8c1f-7d3a-a5e6-b8c9d0e1f2a3' })
  id: string;

  @ApiProperty({ example: '01915d5e-8c1f-7d3a-a5e6-b8c9d0e1f2a3' })
  tenantId: string;

  @ApiProperty({ example: 'agent@sunset.com' })
  email: string;

  @ApiProperty({ example: 'Jane Doe' })
  name: string;

  @ApiProperty({ example: 'agent', enum: ['admin', 'manager', 'agent'] })
  role: string;

  @ApiProperty({ example: 'active', enum: ['active', 'inactive'] })
  status: string;

  @ApiPropertyOptional({ example: '2025-01-15T10:30:00Z' })
  departedAt?: string;

  @ApiPropertyOptional({ example: '0.7000' })
  commissionSplit?: string;

  @ApiProperty({ example: '2025-01-01T00:00:00Z' })
  createdAt: string;

  @ApiProperty({ example: '2025-01-15T10:30:00Z' })
  updatedAt: string;

  @ApiPropertyOptional({ example: null })
  deletedAt?: string | null;
}

/**
 * Response returned when a new user is created.
 * Extends UserResponseDto with an optional generated password.
 */
export class UserCreatedResponseDto {
  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto;

  @ApiPropertyOptional({ example: 'AdminPass123!' })
  generatedPassword?: string;
}

/**
 * Paginated list of users.
 */
export class PaginatedUserResponseDto {
  @ApiProperty({ type: [UserResponseDto] })
  data: UserResponseDto[];

  @ApiProperty({ type: PaginatedMetaDto })
  meta: PaginatedMetaDto;
}

/**
 * Response returned when a user is deactivated.
 */
export class UserDeactivatedResponseDto {
  @ApiProperty({ example: '01915d5e-8c1f-7d3a-a5e6-b8c9d0e1f2a3' })
  userId: string;

  @ApiProperty({ example: 3 })
  unassignedLeads: number;

  @ApiProperty({ example: '2025-01-15T10:30:00Z' })
  departedAt: string;
}