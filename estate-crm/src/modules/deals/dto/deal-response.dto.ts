import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginatedMetaDto } from '@/common/dto/response/paginated-response.dto';
import { DEAL_STAGE_VALUES } from '../enums/deal-constants';
import { DEAL_TYPE_VALUES } from '../enums/deal-constants';

export class CommissionBreakdownDto {
  @ApiProperty({ example: 2500000, description: 'Total calculated commission in cents' })
  calculated: number;

  @ApiProperty({ example: 1625000, description: 'Agent payout in cents' })
  agentPayout: number;

  @ApiProperty({ example: 875000, description: 'Brokerage share in cents' })
  brokerage: number;

  @ApiPropertyOptional({ example: 0.025, description: 'Applied commission rate (decimal 0-1)' })
  appliedRate?: number;

  @ApiPropertyOptional({ example: 'percentage', description: 'Plan type used for calculation' })
  planType?: string;
}

export class PropertySummaryDto {
  @ApiProperty({ example: '01915d5e-8c1f-7d3a-a5e6-b8c9d0e1f2a3' })
  id: string;

  @ApiProperty({ example: 'Modern 2BR Apartment in Palm Hills' })
  title: string;

  @ApiProperty({ example: '123 Main St, New Cairo' })
  address: string;
}

export class AgentSummaryDto {
  @ApiProperty({ example: '01915d5e-8c1f-7d3a-a5e6-b8c9d0e1f2a3' })
  id: string;

  @ApiProperty({ example: 'John Doe' })
  name: string;

  @ApiProperty({ example: 'john@example.com' })
  email: string;
}

export class DealResponseDto {
  @ApiProperty({ example: '01915d5e-8c1f-7d3a-a5e6-b8c9d0e1f2a3' })
  id: string;

  @ApiProperty({ example: '01915d5e-8c1f-7d3a-a5e6-b8c9d0e1f2a4' })
  tenantId: string;

  @ApiPropertyOptional({ example: '01915d5e-8c1f-7d3a-a5e6-b8c9d0e1f2a5', nullable: true })
  propertyId: string | null;

  @ApiPropertyOptional({ description: 'Lead or Client ID', example: '01915d5e-8c1f-7d3a-a5e6-b8c9d0e1f2a6', nullable: true })
  leadId: string | null;

  @ApiProperty({ example: '01915d5e-8c1f-7d3a-a5e6-b8c9d0e1f2a7' })
  agentId: string;

  @ApiProperty({ enum: DEAL_TYPE_VALUES, example: 'standard' })
  type: string;

  @ApiProperty({ example: 45000000 })
  value: number;

  @ApiProperty({ enum: DEAL_STAGE_VALUES, example: 'initialContact' })
  stage: string;

  @ApiPropertyOptional({ example: 50, nullable: true })
  probability: number | null;

  @ApiPropertyOptional({ example: '2026-06-15', nullable: true })
  offerDate: string | null;

  @ApiPropertyOptional({ example: '2026-09-01', nullable: true })
  targetCloseDate: string | null;

  @ApiPropertyOptional({ example: '2026-09-01T10:00:00.000Z', nullable: true })
  closingDate: string | null;

  @ApiPropertyOptional({ example: 77, nullable: true })
  daysUntilClose: number | null;

  @ApiPropertyOptional({ example: 5, nullable: true })
  daysElapsed: number | null;

  @ApiPropertyOptional({ example: 'Negotiating price', nullable: true })
  notes: string | null;

  @ApiProperty({ example: '2026-06-01T10:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-06-09T10:00:00.000Z' })
  updatedAt: string;

  @ApiPropertyOptional({ example: null, nullable: true })
  deletedAt: string | null;

  @ApiPropertyOptional({ description: 'Resolved commission rate (decimal 0-1). null if no plan resolves.', example: 0.05 })
  resolvedRate: number | null;

  @ApiPropertyOptional({ description: 'Forecast commission breakdown in cents. null if no plan resolves.', type: CommissionBreakdownDto })
  resolvedCommission: CommissionBreakdownDto | null;

  // Enriched fields (Fix #6)
  @ApiPropertyOptional({ type: () => PropertySummaryDto, nullable: true, description: 'Enriched property details' })
  property?: PropertySummaryDto | null;

  @ApiPropertyOptional({ type: () => AgentSummaryDto, nullable: true, description: 'Enriched agent details' })
  agent?: AgentSummaryDto | null;

  @ApiPropertyOptional({ example: 14, nullable: true, description: 'Days until target close date (null if closed or no target)' })
  daysUntilClose?: number | null;

  @ApiProperty({ example: 5, description: 'Days elapsed since deal creation' })
  daysElapsed: number;

  @ApiProperty({ enum: ['low', 'medium', 'high'], example: 'low', description: 'Risk level derived from probability' })
  risk: 'low' | 'medium' | 'high';
}

export class PaginatedDealResponseDto {
  @ApiProperty({ type: [DealResponseDto] })
  data: DealResponseDto[];

  @ApiProperty({ type: PaginatedMetaDto })
  meta: PaginatedMetaDto;
}
