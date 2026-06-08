import { IsEmail, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Login request DTO.
 * Validated by NestJS ValidationPipe globally.
 */
export class LoginDto {
  @ApiProperty({ example: 'agent@example.com', description: 'User email address' })
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;

  @ApiProperty({ example: 'SecurePass123!', minLength: 8, description: 'User password' })
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password: string;
}
