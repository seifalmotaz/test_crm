import { IsString, IsEmail, MinLength, MaxLength, IsOptional, IsEnum, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOrganizationDto {
  @ApiProperty({ example: 'Sunset Realty', description: 'Organization name' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: 'sunset-realty', description: 'URL-safe unique slug' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/^[a-z0-9-]+$/, { message: 'Slug must be URL-safe' })
  slug: string;

  @ApiPropertyOptional({ example: 'basic', enum: ['basic', 'pro', 'enterprise'], default: 'basic' })
  @IsOptional()
  @IsEnum(['basic', 'pro', 'enterprise'])
  plan?: string = 'basic';

  @ApiProperty({ example: 'admin@sunset.com', description: 'Initial admin email' })
  @IsEmail()
  adminEmail: string;

  @ApiProperty({ example: 'John Smith', description: 'Initial admin name' })
  @IsString()
  @MinLength(2)
  adminName: string;

  @ApiProperty({ example: 'TempPass123!', minLength: 8, description: 'Initial admin password' })
  @IsString()
  @MinLength(8)
  adminPassword: string;
}
