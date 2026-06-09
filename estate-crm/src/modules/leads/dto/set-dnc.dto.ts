import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SetDncDto {
  @ApiProperty({ example: true, description: 'Whether the lead is on Do-Not-Contact list' })
  @IsBoolean()
  isDnc: boolean;

  @ApiPropertyOptional({ example: 'Asked to stop all contact', description: 'Reason for setting DNC' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
