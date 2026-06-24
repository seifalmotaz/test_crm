import { IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '@/common/dto/pagination.dto';

export class CommissionPlanFiltersDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by default plan (true|false)' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  isDefault?: boolean;

  @ApiPropertyOptional({ example: 'Standard', description: 'Search by plan name' })
  @IsOptional()
  @IsString()
  declare search?: string;
}
