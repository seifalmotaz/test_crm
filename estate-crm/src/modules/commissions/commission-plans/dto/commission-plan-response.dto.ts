import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginatedMetaDto } from '@/common/dto/response/paginated-response.dto';

export class CommissionPlanResponseDto {
  @ApiProperty({ example: '01915d5e-8c1f-7d3a-a5e6-b8c9d0e1f2a3' })
  id: string;

  @ApiProperty({ example: 'Standard 5%' })
  name: string;

  @ApiProperty({ example: 'percentage', enum: ['percentage', 'flat', 'tiered'] })
  type: string;

  @ApiPropertyOptional({ example: '0.0500', nullable: true })
  rate: string | null;

  @ApiPropertyOptional({ example: 100000, nullable: true, description: 'Flat amount in cents' })
  flatAmount: number | null;

  @ApiPropertyOptional({
    example: [{ minValue: 0, maxValue: 50000000, rate: 0.03 }],
    nullable: true,
    description: 'Tier configuration for tiered plans',
  })
  tierConfig: Array<{ minValue: number; maxValue: number; rate: number }> | null;

  @ApiPropertyOptional({
    example: { listingAgentShare: 50, buyerAgentShare: 50 },
    description: 'Split configuration between listing and buyer agents',
  })
  splitConfig: { listingAgentShare: number; buyerAgentShare: number } | null;

  @ApiPropertyOptional({ example: true, description: 'Whether this is the tenant default plan' })
  isDefault: boolean | null;

  @ApiProperty({ example: '2026-06-01T10:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-06-01T10:00:00.000Z' })
  updatedAt: string;
}

export class PaginatedCommissionPlanResponseDto {
  @ApiProperty({ type: [CommissionPlanResponseDto] })
  data: CommissionPlanResponseDto[];

  @ApiProperty({ type: PaginatedMetaDto })
  meta: PaginatedMetaDto;
}
