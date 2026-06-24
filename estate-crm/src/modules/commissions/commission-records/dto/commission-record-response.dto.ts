import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginatedMetaDto } from '@/common/dto/response/paginated-response.dto';

export class CommissionRecordResponseDto {
  @ApiProperty({ example: '01915d5e-8c1f-7d3a-a5e6-b8c9d0e1f2a3' })
  id: string;

  @ApiProperty({ example: '01915d5e-8c1f-7d3a-a5e6-b8c9d0e1f2a4' })
  dealId: string;

  @ApiProperty({ example: '01915d5e-8c1f-7d3a-a5e6-b8c9d0e1f2a5' })
  agentId: string;

  @ApiPropertyOptional({ example: '01915d5e-8c1f-7d3a-a5e6-b8c9d0e1f2a6', nullable: true })
  propertyId: string | null;

  @ApiProperty({ example: '01915d5e-8c1f-7d3a-a5e6-b8c9d0e1f2a7' })
  planId: string;

  @ApiProperty({ example: 2500000, description: 'Total calculated commission in cents' })
  calculatedAmount: number;

  @ApiProperty({ example: 875000, description: 'Brokerage share in cents' })
  brokerageAmount: number;

  @ApiProperty({ example: 1625000, description: 'Agent payout in cents' })
  agentPayoutAmount: number;

  @ApiProperty({ enum: ['calculated'], example: 'calculated' })
  status: string;

  @ApiProperty({ example: '2026-06-15T10:00:00.000Z' })
  calculatedAt: string;

  @ApiProperty({ example: '2026-06-15T10:00:00.000Z' })
  createdAt: string;

  // Optional nested relations
  @ApiPropertyOptional({ description: 'Agent details (name, email)' })
  agent?: { id: string; name: string; email: string } | null;

  @ApiPropertyOptional({ description: 'Deal details (value, stage)' })
  deal?: { id: string; value: number; stage: string } | null;

  @ApiPropertyOptional({ description: 'Plan details (name, type, rate)' })
  plan?: { id: string; name: string; type: string; rate: string | null } | null;

  @ApiPropertyOptional({ description: 'Property details (title)' })
  property?: { id: string; title: string } | null;
}

export class PaginatedCommissionRecordResponseDto {
  @ApiProperty({ type: [CommissionRecordResponseDto] })
  data: CommissionRecordResponseDto[];

  @ApiProperty({ type: PaginatedMetaDto })
  meta: PaginatedMetaDto;
}
