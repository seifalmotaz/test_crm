import { IsString, IsIn, IsOptional, IsObject, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LEAD_ACTIVITY_TYPE_VALUES } from '../enums/lead-constants';

export class AddActivityDto {
  @ApiProperty({ enum: LEAD_ACTIVITY_TYPE_VALUES, example: 'call', description: 'Activity type' })
  @IsString()
  @IsIn([...LEAD_ACTIVITY_TYPE_VALUES])
  @MaxLength(30)
  type: string;

  @ApiProperty({ example: 'Discussed budget and timeline. Follow up next week.', description: 'Activity content', minLength: 1 })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content: string;

  @ApiPropertyOptional({ example: { duration: 15, outcome: 'positive' }, description: 'Type-specific metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
