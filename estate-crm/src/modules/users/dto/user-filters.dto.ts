import { IsOptional, IsString, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '@/common/dto/pagination.dto';

export class UserFiltersDto extends PaginationDto {
  @ApiPropertyOptional({ example: 'active', enum: ['active', 'inactive'], description: 'Filter by status' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 'agent', enum: ['admin', 'manager', 'agent'], description: 'Filter by role' })
  @IsOptional()
  @IsEnum(['admin', 'manager', 'agent'])
  role?: string;
}
