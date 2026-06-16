import { IsOptional, IsString, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { DEAL_ACTIVITY_TYPE_VALUES } from '../enums/deal-constants';

export class ActivityFiltersDto extends PaginationDto {
  @ApiPropertyOptional({ enum: DEAL_ACTIVITY_TYPE_VALUES, description: 'Filter by activity type' })
  @IsOptional()
  @IsString()
  @IsIn([...DEAL_ACTIVITY_TYPE_VALUES])
  type?: string;

  @ApiPropertyOptional({ description: 'Search in activity content' })
  @IsOptional()
  @IsString()
  declare search?: string;
}
