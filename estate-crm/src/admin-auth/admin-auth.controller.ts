import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiCookieAuth,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { AdminAuthService } from './admin-auth.service';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { AdminLoginDto } from './dto/admin-login.dto';
import { ProblemDetailsDto } from '@/common/dto/response/problem-details.dto';
import { config } from '@/config/app.config';
import type { AdminAuthenticatedUser } from '@/common/types/auth.types';

@ApiTags('Admin Auth')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Super admin login' })
  @ApiBody({ type: AdminLoginDto })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 400, description: 'Validation error', type: ProblemDetailsDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials', type: ProblemDetailsDto })
  async login(
    @Body() body: AdminLoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.adminAuthService.login(body.email, body.password);

    response.cookie('access_token', result.accessToken, {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'none',
      maxAge: 15 * 60 * 1000,
      path: '/',
      domain: config.COOKIE_DOMAIN,
    });

    response.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
      domain: config.COOKIE_DOMAIN,
    });

    return result.admin;
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current super admin profile' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 200, description: 'Current admin profile' })
  @ApiResponse({ status: 401, description: 'Not authenticated', type: ProblemDetailsDto })
  async me(@CurrentUser() user: AdminAuthenticatedUser) {
    return this.adminAuthService.getMe(user.id);
  }
}
