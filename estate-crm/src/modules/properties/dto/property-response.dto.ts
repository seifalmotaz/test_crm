import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginatedMetaDto } from '@/common/dto/response/paginated-response.dto';

/**
 * Property object returned by property endpoints.
 */
export class PropertyResponseDto {
  @ApiProperty({ example: '01915d5e-8c1f-7d3a-a5e6-b8c9d0e1f2a3' })
  id: string;

  @ApiProperty({ example: '01915d5e-8c1f-7d3a-a5e6-b8c9d0e1f2a3' })
  tenantId: string;

  @ApiPropertyOptional({ example: '01915d5e-8c1f-7d3a-a5e6-b8c9d0e1f2a3' })
  projectId?: string;

  @ApiProperty({ example: 'Modern 2BR Apartment in Palm Hills' })
  title: string;

  @ApiProperty({ example: '123 Main St, New Cairo' })
  address: string;

  @ApiProperty({ example: 'apartment', enum: ['apartment', 'villa', 'commercial', 'land', 'townhouse'] })
  type: string;

  @ApiProperty({ example: 'active', enum: ['active', 'pending', 'sold', 'withdrawn'] })
  status: string;

  @ApiProperty({ example: 250000 })
  price: number;

  @ApiPropertyOptional({ example: 2 })
  beds?: number;

  @ApiPropertyOptional({ example: 2 })
  baths?: number;

  @ApiPropertyOptional({ example: 1500 })
  sqft?: number;

  @ApiPropertyOptional({ example: 2020 })
  yearBuilt?: number;

  @ApiPropertyOptional({ example: { amenities: ['pool', 'gym'], furnishing: 'fully' } })
  attributes?: Record<string, unknown>;

  @ApiPropertyOptional({ example: ['https://images.example.com/prop1.jpg'] })
  images?: string[];

  @ApiPropertyOptional({ example: ['https://videos.example.com/prop1.mp4'] })
  videos?: string[];

  @ApiPropertyOptional({ example: ['luxury', 'pool'] })
  tags?: string[];

  @ApiPropertyOptional({ example: '01915d5e-8c1f-7d3a-a5e6-b8c9d0e1f2a3' })
  agentId?: string;

  @ApiPropertyOptional({ example: '01915d5e-8c1f-7d3a-a5e6-b8c9d0e1f2a3' })
  commissionPlanId?: string;

  @ApiPropertyOptional({ example: 'Beautiful apartment with a view' })
  description?: string;

  @ApiProperty({ example: '2025-01-01T00:00:00Z' })
  createdAt: string;

  @ApiProperty({ example: '2025-01-15T10:30:00Z' })
  updatedAt: string;

  @ApiPropertyOptional({ example: null })
  deletedAt?: string | null;
}

/**
 * Paginated list of properties.
 */
export class PaginatedPropertyResponseDto {
  @ApiProperty({ type: [PropertyResponseDto] })
  data: PropertyResponseDto[];

  @ApiProperty({ type: PaginatedMetaDto })
  meta: PaginatedMetaDto;
}