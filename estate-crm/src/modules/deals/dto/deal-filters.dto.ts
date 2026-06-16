import { IsOptional, IsString, IsInt, IsUUID, IsIn, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { DEAL_STAGE_VALUES } from '../enums/deal-constants';
import { DEAL_TYPE_VALUES } from '../enums/deal-constants';

export class DealFiltersDto extends PaginationDto {
  @ApiPropertyOptional({ enum: DEAL_STAGE_VALUES, description: 'Filter by deal stage' })
  @IsOptional()
  @IsString()
  @IsIn([...DEAL_STAGE_VALUES])
  stage?: string;

  @ApiPropertyOptional({ enum: DEAL_TYPE_VALUES, description: 'Filter by deal type' })
  @IsOptional()
  @IsString()
  @IsIn([...DEAL_TYPE_VALUES])
  type?: string;

  @ApiPropertyOptional({ description: 'Filter by agent ID' })
  @IsOptional()
  @IsUUID()
  agentId?: string;

  @ApiPropertyOptional({ description: 'Filter by property ID' })
  @IsOptional()
  @IsUUID()
  propertyId?: string;

  @ApiPropertyOptional({ description: 'Filter by lead ID' })
  @IsOptional()
  @IsUUID()
  leadId?: string;

  @ApiPropertyOptional({ description: 'Minimum deal value in cents', minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  minValue?: number;

  @ApiPropertyOptional({ description: 'Maximum deal value in cents', minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxValue?: number;
}
