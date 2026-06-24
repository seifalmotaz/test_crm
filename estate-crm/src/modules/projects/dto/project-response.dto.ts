import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginatedMetaDto } from '@/common/dto/response/paginated-response.dto';

/**
 * Project object returned by project endpoints.
 */
export class ProjectResponseDto {
  @ApiProperty({ example: '01915d5e-8c1f-7d3a-a5e6-b8c9d0e1f2a3' })
  id: string;

  @ApiProperty({ example: '01915d5e-8c1f-7d3a-a5e6-b8c9d0e1f2a3' })
  tenantId: string;

  @ApiProperty({ example: 'Sunset Heights' })
  name: string;

  @ApiPropertyOptional({ example: 'A luxury residential complex in Palm Hills' })
  description?: string;

  @ApiProperty({ example: 'Palm Hills, New Cairo' })
  location: string;

  @ApiPropertyOptional({ example: 'Sunset Development Co.' })
  developerName?: string;

  @ApiProperty({ example: 'active', enum: ['planning', 'preLaunch', 'active', 'soldOut', 'delivered'] })
  status: string;

  @ApiPropertyOptional({ example: '2026-06-01T00:00:00Z' })
  launchDate?: string;

  @ApiPropertyOptional({ example: '2028-12-31T00:00:00Z' })
  completionDate?: string;

  @ApiPropertyOptional({ example: 200 })
  totalUnits?: number;

  @ApiPropertyOptional({ example: 0 })
  soldUnits?: number;

  @ApiPropertyOptional({ example: ['https://images.example.com/proj1.jpg'], type: [String] })
  images?: string[];

  @ApiPropertyOptional({ example: '01915d5e-8c1f-7d3a-a5e6-b8c9d0e1f2a3' })
  commissionPlanId?: string;

  @ApiProperty({ example: '2025-01-01T00:00:00Z' })
  createdAt: string;

  @ApiProperty({ example: '2025-01-15T10:30:00Z' })
  updatedAt: string;

  @ApiPropertyOptional({ example: null })
  deletedAt?: string | null;
}

/**
 * Paginated list of projects.
 */
export class PaginatedProjectResponseDto {
  @ApiProperty({ type: [ProjectResponseDto] })
  data: ProjectResponseDto[];

  @ApiProperty({ type: PaginatedMetaDto })
  meta: PaginatedMetaDto;
}