import { IsString, IsOptional, IsInt, IsUUID, IsEmail, Min, MaxLength, MinLength, IsDateString } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateClientDto {
  @ApiPropertyOptional({ example: 'Ahmed Hassan Updated', description: 'Client full name' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ example: 'new@example.com', description: 'Client email address' })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ example: '+201009876543', description: 'Client phone number' })
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({ example: 'investor', description: 'Client type' })
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

  @ApiPropertyOptional({ description: 'VIP status (manager/admin only)', default: false })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  isVip?: boolean;

  @ApiPropertyOptional({ description: 'Lifetime value in cents (manager/admin only)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  lifetimeValue?: number;
}
