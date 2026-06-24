import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, IsDateString } from 'class-validator';

export class CommissionSummaryResponseDto {
  @ApiProperty({ example: 10000000, description: 'Total calculated commission in cents' })
  totalCalculated: number;

  @ApiProperty({ example: 3500000, description: 'Total brokerage amount in cents' })
  totalBrokerage: number;

  @ApiProperty({ example: 6500000, description: 'Total agent payout in cents' })
  totalAgentPayout: number;

  @ApiProperty({ example: 5, description: 'Number of commission records' })
  count: number;
}

export class CommissionSummaryFiltersDto {
  @ApiPropertyOptional({ description: 'Filter by agent ID' })
  @IsOptional()
  @IsUUID()
  agentId?: string;

  @ApiPropertyOptional({ description: 'Filter by date from (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Filter by date to (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
