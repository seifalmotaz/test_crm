import { IsString, IsOptional, IsInt, IsUUID, IsIn, Min, Max, MaxLength, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DEAL_TYPE_VALUES } from '../enums/deal-constants';

export class UpdateDealDto {
  @ApiPropertyOptional({ description: 'Agent ID' })
  @IsOptional()
  @IsUUID()
  agentId?: string;

  @ApiPropertyOptional({ description: 'Property ID' })
  @IsOptional()
  @IsUUID()
  propertyId?: string;

  @ApiPropertyOptional({ description: 'Lead or Client ID' })
  @IsOptional()
  @IsUUID()
  leadId?: string;

  @ApiPropertyOptional({ description: 'Deal type', enum: DEAL_TYPE_VALUES })
  @IsOptional()
  @IsString()
  @IsIn([...DEAL_TYPE_VALUES])
  @MaxLength(20)
  type?: string;

  @ApiPropertyOptional({ description: 'Deal value in cents', minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  value?: number;

  @ApiPropertyOptional({ description: 'Probability percentage (0-100)', minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  probability?: number;

  @ApiPropertyOptional({ description: 'Offer date' })
  @IsOptional()
  @IsDateString()
  offerDate?: string;

  @ApiPropertyOptional({ description: 'Target close date' })
  @IsOptional()
  @IsDateString()
  targetCloseDate?: string;

  @ApiPropertyOptional({ description: 'Internal notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
