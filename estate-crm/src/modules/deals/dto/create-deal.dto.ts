import { IsString, IsOptional, IsInt, IsUUID, IsIn, Min, Max, MaxLength, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DEAL_TYPE_VALUES } from '../enums/deal-constants';

export class CreateDealDto {
  @ApiProperty({ description: 'Agent ID (required)', example: '01915d5e-8c1f-7d3a-a5e6-b8c9d0e1f2a3' })
  @IsUUID()
  agentId: string;

  @ApiPropertyOptional({ description: 'Property ID — at least one of propertyId or leadId is required' })
  @IsOptional()
  @IsUUID()
  propertyId?: string;

  @ApiPropertyOptional({ description: 'Lead or Client ID — at least one of propertyId or leadId is required' })
  @IsOptional()
  @IsUUID()
  leadId?: string;

  @ApiProperty({ description: 'Deal type', enum: DEAL_TYPE_VALUES, example: 'standard' })
  @IsString()
  @IsIn([...DEAL_TYPE_VALUES])
  @MaxLength(20)
  type: string;

  @ApiProperty({ description: 'Deal value in cents', example: 45000000, minimum: 0 })
  @IsInt()
  @Min(0)
  value: number;

  @ApiPropertyOptional({ description: 'Probability percentage (0-100)', default: 50, minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  probability?: number;

  @ApiPropertyOptional({ description: 'Offer date', example: '2026-06-15' })
  @IsOptional()
  @IsDateString()
  offerDate?: string;

  @ApiPropertyOptional({ description: 'Target close date', example: '2026-09-01' })
  @IsOptional()
  @IsDateString()
  targetCloseDate?: string;

  @ApiPropertyOptional({ description: 'Internal notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  /**
   * Custom validation: at least one of propertyId or leadId must be provided.
   * leadId accepts both Lead and Client IDs (clients are leads with isClient=true).
   * This is enforced at the service layer, not DTO level, because class-validator
   * cross-field validation is complex and we want a clean VALIDATION_ERROR response.
   */
}
