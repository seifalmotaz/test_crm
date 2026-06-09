import { IsString, IsOptional, IsInt, IsUUID, IsEmail, Min, Max, MaxLength, MinLength, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateLeadDto {
  @ApiPropertyOptional({ example: 'Ahmed Hassan Updated', description: 'Lead full name' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ example: 'new@example.com', description: 'Lead email address' })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ example: '+201009876543', description: 'Lead phone number' })
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({ example: 'referral', description: 'Lead source' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  source?: string;

  @ApiPropertyOptional({ example: 'investor', description: 'Lead type' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  type?: string;

  @ApiPropertyOptional({ example: 15000000, description: 'Minimum budget in cents' })
  @IsOptional()
  @IsInt()
  @Min(0)
  budgetMin?: number;

  @ApiPropertyOptional({ example: 35000000, description: 'Maximum budget in cents' })
  @IsOptional()
  @IsInt()
  @Min(0)
  budgetMax?: number;

  @ApiPropertyOptional({ example: 6, description: 'Timeline in months' })
  @IsOptional()
  @IsInt()
  @Min(0)
  timeline?: number;

  @ApiPropertyOptional({ example: '6th October', description: 'Preferred location' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  preferredLocation?: string;

  @ApiPropertyOptional({ example: 'villa', description: 'Preferred property type' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  preferredType?: string;

  @ApiPropertyOptional({ example: '01915d5e-8c1f-7d3a-a5e6-b8c9d0e1f2a3', description: 'Assigned agent ID' })
  @IsOptional()
  @IsUUID()
  agentId?: string;

  @ApiPropertyOptional({ example: 'Updated notes', description: 'Internal notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: 'Send listings', description: 'Next action label' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  nextAction?: string;

  @ApiPropertyOptional({ example: '2026-06-20T10:00:00Z', description: 'Next action due date' })
  @IsOptional()
  @IsDateString()
  nextActionDate?: string;

  @ApiPropertyOptional({ example: 85, minimum: 0, maximum: 100, description: 'Lead score (0-100). Manager/admin only.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  score?: number;
}
