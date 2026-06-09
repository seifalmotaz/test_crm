import { IsEmail, IsString, IsEnum, IsOptional, IsNumber, MinLength, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'jane.doe@sunset.com', description: 'User email address' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'Jane Doe-Updated', description: 'Full name', minLength: 2 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional({ example: 0.7, minimum: 0, maximum: 1, description: 'Commission split' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  commissionSplit?: number;

  @ApiPropertyOptional({ example: 'active', enum: ['active', 'inactive'], description: 'User status' })
  @IsOptional()
  @IsEnum(['active', 'inactive'])
  status?: string;
}
