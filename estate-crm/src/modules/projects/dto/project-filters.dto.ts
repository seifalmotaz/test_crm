import { IsOptional, IsString, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { ProjectStatus } from '@/modules/projects/enums/project-status.enum';

export class ProjectFiltersDto extends PaginationDto {
  @ApiPropertyOptional({
    example: 'active',
    enum: ProjectStatus,
    description: 'Filter by project status',
  })
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @ApiPropertyOptional({ example: 'Sunset', description: 'Search by name or location' })
  @IsOptional()
  @IsString()
  declare search?: string;
}