import { IsString, IsOptional, IsInt, IsUUID, IsEmail, Min, Max, MaxLength, MinLength, IsDateString, IsIn, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, ApiHideProperty } from '@nestjs/swagger';
import { LEAD_STAGE_VALUES } from '../enums/lead-constants';

export class CreateLeadDto {
  @ApiProperty({ example: 'Ahmed Hassan', description: 'Lead full name', minLength: 1 })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ example: 'ahmed@example.com', description: 'Lead email address' })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiProperty({ example: '+201001234567', description: 'Lead phone number', minLength: 5 })
  @IsString()
  @MinLength(5)
  @MaxLength(50)
  phone: string;

  @ApiProperty({ example: 'website', description: 'Lead source (e.g., website, referral, social_media, walk_in, cold_call, advertisement, portal, other)' })
  @IsString()
  @MaxLength(20)
  source: string;

  @ApiProperty({ example: 'buyer', description: 'Lead type (e.g., buyer, seller, renter, investor)' })
  @IsString()
  @MaxLength(20)
  type: string;

  @ApiPropertyOptional({ example: 10000000, description: 'Minimum budget in cents' })
  @IsOptional()
  @IsInt()
  @Min(0)
  budgetMin?: number;

  @ApiPropertyOptional({ example: 30000000, description: 'Maximum budget in cents' })
  @IsOptional()
  @IsInt()
  @Min(0)
  budgetMax?: number;

  @ApiPropertyOptional({ example: 3, description: 'Timeline in months' })
  @IsOptional()
  @IsInt()
  @Min(0)
  timeline?: number;

  @ApiPropertyOptional({ example: 'New Cairo', description: 'Preferred location' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  preferredLocation?: string;

  @ApiPropertyOptional({ example: 'apartment', description: 'Preferred property type' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  preferredType?: string;

  @ApiPropertyOptional({ example: 'fresh', enum: LEAD_STAGE_VALUES, description: 'Initial stage (defaults to fresh)' })
  @IsOptional()
  @IsIn([...LEAD_STAGE_VALUES])
  stage?: string;

  @ApiPropertyOptional({ example: '01915d5e-8c1f-7d3a-a5e6-b8c9d0e1f2a3', description: 'Assigned agent ID' })
  @IsOptional()
  @IsUUID()
  agentId?: string;

  @ApiPropertyOptional({ example: 'Looking for 3BR in New Cairo', description: 'Internal notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: 'Call back tomorrow', description: 'Next action label' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  nextAction?: string;

  @ApiPropertyOptional({ example: '2026-06-15T10:00:00Z', description: 'Next action due date' })
  @IsOptional()
  @IsDateString()
  nextActionDate?: string;

  @ApiPropertyOptional({ example: 75, minimum: 0, maximum: 100, description: 'Lead score (0-100)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  score?: number;

  @ApiHideProperty()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  isClient?: boolean;
}
