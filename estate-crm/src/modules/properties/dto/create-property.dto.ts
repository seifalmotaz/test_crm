import { IsString, IsOptional, IsInt, IsUUID, IsEnum, Min, MinLength, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PropertyType } from '@/modules/properties/enums/property-type.enum';
import { PropertyStatus } from '@/modules/properties/enums/property-status.enum';

export class CreatePropertyDto {
  @ApiProperty({ example: 'Modern 2BR Apartment in Palm Hills', description: 'Property title', minLength: 1 })
  @IsString()
  @MinLength(1)
  title: string;

  @ApiProperty({ example: '123 Main St, New Cairo', description: 'Property address' })
  @IsString()
  address: string;

  @ApiProperty({ example: 'apartment', enum: PropertyType, description: 'Property type' })
  @IsEnum(PropertyType)
  type: PropertyType;

  @ApiProperty({ example: 250000, minimum: 0, description: 'Property price in cents' })
  @IsInt()
  @Min(0)
  price: number;

  @ApiPropertyOptional({ example: 'active', enum: PropertyStatus, description: 'Initial property status' })
  @IsOptional()
  @IsEnum(PropertyStatus)
  status?: PropertyStatus;

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
}