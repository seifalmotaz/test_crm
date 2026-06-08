import { ApiProperty } from '@nestjs/swagger';

/**
 * User object returned by auth endpoints (login, me, refresh).
 * Excludes sensitive fields like passwordHash.
 */
export class AuthResponseDto {
  @ApiProperty({ example: '01915d5e-8c1f-7d3a-a5e6-b8c9d0e1f2a3' })
  id: string;

  @ApiProperty({ example: 'agent@example.com' })
  email: string;

  @ApiProperty({ example: 'John Smith' })
  name: string;

  @ApiProperty({ example: 'agent', enum: ['admin', 'manager', 'agent'] })
  role: string;

  @ApiProperty({ example: '01915d5e-8c1f-7d3a-a5e6-b8c9d0e1f2a3' })
  tenantId: string;

  @ApiProperty({ example: 'Sunset Realty' })
  tenantName: string;

  @ApiProperty({ example: 'active', enum: ['active', 'inactive', 'suspended'] })
  status: string;
}
