import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersService } from './users.service';

/**
 * Auth module handles authentication, JWT token management,
 * and session lifecycle. Guards and decorators live in common/.
 */
@Module({
  controllers: [AuthController],
  providers: [AuthService, UsersService],
  exports: [AuthService, UsersService],
})
export class AuthModule {}
