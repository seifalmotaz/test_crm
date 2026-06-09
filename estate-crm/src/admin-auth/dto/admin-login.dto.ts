import { IsEmail, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AdminLoginDto {
  @ApiProperty({ example: 'super@admin.com', description: 'Super admin email address' })
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;

  @ApiProperty({ example: 'SuperSecure123!', minLength: 8, description: 'Super admin password' })
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password: string;
}
