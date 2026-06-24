import { IsOptional, IsString, IsUUID, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '@/common/dto/pagination.dto';

export class CommissionRecordFiltersDto extends PaginationDto {
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
