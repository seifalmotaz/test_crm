import { IsString, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddTagDto {
  @ApiProperty({ description: 'Tag label', example: 'VIP', minLength: 1, maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  tag: string;

  @ApiProperty({ description: 'Hex color code', example: '#EF4444' })
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'color must be a valid hex color (e.g., #FF0000)' })
  color: string;
}
