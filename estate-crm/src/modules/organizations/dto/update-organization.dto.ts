import { IsString, IsOptional, IsEnum, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateOrganizationDto {
  @ApiPropertyOptional({ example: 'Sunset Realty' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ example: 'sunset-realty' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/^[a-z0-9-]+$/, { message: 'Slug must be URL-safe' })
  slug?: string;

  @ApiPropertyOptional({ enum: ['active', 'suspended', 'inactive'] })
  @IsOptional()
  @IsEnum(['active', 'suspended', 'inactive'])
  status?: string;

  @ApiPropertyOptional({ enum: ['basic', 'pro', 'enterprise'] })
  @IsOptional()
  @IsEnum(['basic', 'pro', 'enterprise'])
  plan?: string;

  @ApiPropertyOptional({ description: 'Organization settings' })
  @IsOptional()
  settings?: Record<string, unknown>;
}
