import { IsOptional, IsString, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { LEAD_ACTIVITY_TYPE_VALUES } from '../enums/lead-constants';

export class ActivityFiltersDto extends PaginationDto {
  @ApiPropertyOptional({ enum: LEAD_ACTIVITY_TYPE_VALUES, description: 'Filter by activity type' })
  @IsOptional()
  @IsString()
  @IsIn([...LEAD_ACTIVITY_TYPE_VALUES])
  type?: string;

  @ApiPropertyOptional({ description: 'Search in activity content' })
  @IsOptional()
  @IsString()
  declare search?: string;
}
