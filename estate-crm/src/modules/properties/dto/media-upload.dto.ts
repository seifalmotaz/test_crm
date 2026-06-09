import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MediaUploadDto {
  @ApiProperty({ example: 'photo.jpg', description: 'File name with extension' })
  @IsString()
  @MinLength(1)
  filename: string;

  @ApiProperty({ example: 'image/jpeg', description: 'MIME content type' })
  @IsString()
  @MinLength(1)
  contentType: string;
}