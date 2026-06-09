import { IsOptional, IsString, IsEnum, IsUUID, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { PropertyType } from '@/modules/properties/enums/property-type.enum';
import { PropertyStatus } from '@/modules/properties/enums/property-status.enum';

export class PropertyFiltersDto extends PaginationDto {
  @ApiPropertyOptional({ example: 'active', enum: PropertyStatus, description: 'Filter by property status' })
  @IsOptional()
  @IsEnum(PropertyStatus)
  status?: PropertyStatus;

  @ApiPropertyOptional({ example: 'apartment', enum: PropertyType, description: 'Filter by property type' })
  @IsOptional()
  @IsEnum(PropertyType)
  type?: PropertyType;

  @ApiPropertyOptional({ example: '01915d5e-8c1f-7d3a-a5e6-b8c9d0e1f2a3', description: 'Filter by project ID' })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({ example: 100000, description: 'Minimum price filter' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ example: 500000, description: 'Maximum price filter' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({ example: 2, description: 'Filter by minimum number of bedrooms' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  beds?: number;

  @ApiPropertyOptional({ example: 'Palm Hills', description: 'Search by title or address' })
  @IsOptional()
  @IsString()
  declare search?: string;
}