import { IsString, IsOptional, IsInt, IsEnum, Min, MinLength, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectStatus } from '@/modules/projects/enums/project-status.enum';

export class CreateProjectDto {
  @ApiProperty({ example: 'Sunset Heights', description: 'Project name', minLength: 2 })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional({ example: 'planning', enum: ProjectStatus, description: 'Initial project status' })
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @ApiPropertyOptional({ example: 'A luxury residential complex in Palm Hills', description: 'Project description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'Palm Hills, New Cairo', description: 'Project location' })
  @IsString()
  location: string;

  @ApiPropertyOptional({ example: 'Sunset Development Co.', description: 'Developer name' })
  @IsOptional()
  @IsString()
  developerName?: string;

  @ApiPropertyOptional({ example: '2026-06-01', description: 'Launch date (ISO 8601 date string)' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'launchDate must be a valid ISO date (YYYY-MM-DD)' })
  launchDate?: string;

  @ApiPropertyOptional({ example: '2028-12-31', description: 'Completion date (ISO 8601 date string)' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'completionDate must be a valid ISO date (YYYY-MM-DD)' })
  completionDate?: string;

  @ApiPropertyOptional({ example: 200, description: 'Total number of units', minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  totalUnits?: number;
}