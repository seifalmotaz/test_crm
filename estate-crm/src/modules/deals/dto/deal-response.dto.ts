import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginatedMetaDto } from '@/common/dto/response/paginated-response.dto';
import { DEAL_STAGE_VALUES } from '../enums/deal-constants';
import { DEAL_TYPE_VALUES } from '../enums/deal-constants';

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
}

export class PaginatedDealResponseDto {
  @ApiProperty({ type: [DealResponseDto] })
  data: DealResponseDto[];

  @ApiProperty({ type: PaginatedMetaDto })
  meta: PaginatedMetaDto;
}
