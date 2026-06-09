import { IsEmail, IsString, IsEnum, IsOptional, IsNumber, MinLength, MaxLength, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'agent@sunset.com', description: 'User email address' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Jane Doe', description: 'Full name', minLength: 2 })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 'agent', enum: ['admin', 'manager', 'agent'], description: 'User role' })
  @IsEnum(['admin', 'manager', 'agent'])
  role: string;

  @ApiPropertyOptional({ example: 'Password123!', minLength: 8, description: 'Initial password (auto-generated if omitted)' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @ApiPropertyOptional({ example: 0.7, minimum: 0, maximum: 1, description: 'Commission split (required when role is agent)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  commissionSplit?: number;
}
