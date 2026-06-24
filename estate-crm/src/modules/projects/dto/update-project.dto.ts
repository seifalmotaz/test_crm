import { IsString, IsOptional, IsInt, IsUUID, IsArray, Min, MinLength, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProjectDto {
  @ApiPropertyOptional({ example: 'Sunset Heights', description: 'Project name', minLength: 2 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional({ example: 'A luxury residential complex in Palm Hills', description: 'Project description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'Palm Hills, New Cairo', description: 'Project location' })
  @IsOptional()
  @IsString()
  location?: string;

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

  @ApiPropertyOptional({ example: ['https://images.example.com/proj1.jpg'], type: [String], description: 'Project image URLs' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @ApiPropertyOptional({ example: '01915d5e-8c1f-7d3a-a5e6-b8c9d0e1f2a3', description: 'Commission plan ID' })
  @IsOptional()
  @IsUUID()
  commissionPlanId?: string;
}