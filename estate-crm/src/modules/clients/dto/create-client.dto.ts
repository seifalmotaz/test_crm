import { IsString, IsOptional, IsInt, IsUUID, IsEmail, Min, Max, MaxLength, MinLength, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateClientDto {
  @ApiProperty({ example: 'Ahmed Hassan', description: 'Client full name', minLength: 1 })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ example: 'ahmed@example.com', description: 'Client email address' })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiProperty({ example: '+201001234567', description: 'Client phone number', minLength: 5 })
  @IsString()
  @MinLength(5)
  @MaxLength(50)
  phone: string;

  @ApiProperty({ example: 'buyer', description: 'Client type (e.g., buyer, seller, renter, investor)' })
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

  @ApiPropertyOptional({ example: '01915d5e-8c1f-7d3a-a5e6-b8c9d0e1f2a3', description: 'Assigned agent ID' })
  @IsOptional()
  @IsUUID()
  agentId?: string;

  @ApiPropertyOptional({ example: 'Referred by partner', description: 'Internal notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: 'Follow up next week', description: 'Next action label' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  nextAction?: string;

  @ApiPropertyOptional({ example: '2026-06-15T10:00:00Z', description: 'Next action due date' })
  @IsOptional()
  @IsDateString()
  nextActionDate?: string;

  @ApiPropertyOptional({ example: 50000000, description: 'Lifetime value in cents' })
  @IsOptional()
  @IsInt()
  @Min(0)
  lifetimeValue?: number;

  // NOTE: No `source` field — clients are always `source: 'direct'`
  // NOTE: No `stage` field — clients skip the pipeline
  // NOTE: No `score` field — only managers can set score
}
