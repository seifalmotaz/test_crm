import { IsString, IsOptional, IsInt, IsUUID, IsEnum, Min, MinLength, IsObject, IsArray } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PropertyType } from '@/modules/properties/enums/property-type.enum';

export class UpdatePropertyDto {
  @ApiPropertyOptional({ example: 'Modern 2BR Apartment in Palm Hills', description: 'Property title', minLength: 1 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @ApiPropertyOptional({ example: '123 Main St, New Cairo', description: 'Property address' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 'apartment', enum: PropertyType, description: 'Property type' })
  @IsOptional()
  @IsEnum(PropertyType)
  type?: PropertyType;

  @ApiPropertyOptional({ example: 250000, minimum: 0, description: 'Property price in cents' })
  @IsOptional()
  @IsInt()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ example: 2, description: 'Number of bedrooms' })
  @IsOptional()
  @IsInt()
  @Min(0)
  beds?: number;

  @ApiPropertyOptional({ example: 2, description: 'Number of bathrooms' })
  @IsOptional()
  @IsInt()
  @Min(0)
  baths?: number;

  @ApiPropertyOptional({ example: 1500, description: 'Square footage' })
  @IsOptional()
  @IsInt()
  @Min(0)
  sqft?: number;

  @ApiPropertyOptional({ example: 2020, description: 'Year built' })
  @IsOptional()
  @IsInt()
  yearBuilt?: number;

  @ApiPropertyOptional({ example: { amenities: ['pool', 'gym'], furnishing: 'fully' }, description: 'Type-specific attributes' })
  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;

  @ApiPropertyOptional({ example: '01915d5e-8c1f-7d3a-a5e6-b8c9d0e1f2a3', description: 'Associated project ID' })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({ example: '01915d5e-8c1f-7d3a-a5e6-b8c9d0e1f2a3', description: 'Assigned agent ID' })
  @IsOptional()
  @IsUUID()
  agentId?: string;

  @ApiPropertyOptional({ example: 'Beautiful apartment with a view', description: 'Property description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: ['https://bucket.s3.region.amazonaws.com/properties/...'], description: 'Property image URLs' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];
}