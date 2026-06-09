import { IsString, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddTagDto {
  @ApiProperty({ example: 'Hot', description: 'Tag label', minLength: 1 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  tag: string;

  @ApiProperty({ example: '#EF4444', description: 'Hex color (e.g., #FF0000)' })
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'color must be a valid hex color (e.g., #FF0000)' })
  color: string;
}
