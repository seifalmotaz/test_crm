import { IsString, IsOptional, IsIn, MinLength, MaxLength, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DEAL_ACTIVITY_TYPE_VALUES } from '../enums/deal-constants';

export class AddActivityDto {
  @ApiProperty({ enum: DEAL_ACTIVITY_TYPE_VALUES, description: 'Activity type', example: 'call' })
  @IsString()
  @IsIn([...DEAL_ACTIVITY_TYPE_VALUES])
  @MaxLength(30)
  type: string;

  @ApiProperty({ description: 'Activity content', minLength: 1, maxLength: 2000 })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
