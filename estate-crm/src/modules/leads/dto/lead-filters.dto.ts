import { IsOptional, IsString, IsUUID, IsIn } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { LEAD_STAGE_VALUES } from '../enums/lead-constants';

export class LeadFiltersDto extends PaginationDto {
  @ApiPropertyOptional({ enum: LEAD_STAGE_VALUES, description: 'Filter by lead stage' })
  @IsOptional()
  @IsIn([...LEAD_STAGE_VALUES])
  stage?: string;

  @ApiPropertyOptional({ example: 'website', description: 'Filter by lead source' })
  @IsOptional()
  @IsString()
  @Type(() => String)
  source?: string;

  @ApiPropertyOptional({ example: 'buyer', description: 'Filter by lead type' })
  @IsOptional()
  @IsString()
  @Type(() => String)
  type?: string;

  @ApiPropertyOptional({ description: 'Filter by assigned agent ID' })
  @IsOptional()
  @IsUUID()
  agentId?: string;

  @ApiPropertyOptional({ description: 'Filter by DNC status (true|false)' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  isDnc?: boolean;

  @ApiPropertyOptional({ description: 'Filter by converted status (true|false)' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  isConverted?: boolean;

  @ApiPropertyOptional({ example: 'Ahmed', description: 'Search by name, email, or phone' })
  @IsOptional()
  @IsString()
  declare search?: string;
}
