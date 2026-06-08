import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  Req,
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
import type { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from '@/common/dto/response/auth-response.dto';
import { LogoutResponseDto } from '@/common/dto/response/logout-response.dto';
import { ProblemDetailsDto } from '@/common/dto/response/problem-details.dto';
import { AppError } from '@/common/errors/app-error';
import { ErrorCodes } from '@/common/errors/error-codes';
import { config } from '@/config/app.config';
import type { AuthenticatedUser } from '@/common/types/auth.types';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Login successful', type: AuthResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error', type: ProblemDetailsDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials', type: ProblemDetailsDto })
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(body.email, body.password);

    response.cookie('access_token', result.accessToken, {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
      path: '/',
      domain: config.COOKIE_DOMAIN,
    });

    response.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
      domain: config.COOKIE_DOMAIN,
    });

    return result.user;
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using expired token cookie' })
  @ApiResponse({ status: 200, description: 'Token refreshed', type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Token expired or invalid', type: ProblemDetailsDto })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const expiredToken = (request.cookies as Record<string, string>)?.access_token;

    if (!expiredToken) {
      throw new AppError(ErrorCodes.TOKEN_EXPIRED, 401, 'No access token provided');
    }

    const result = await this.authService.refresh(expiredToken);

    response.cookie('access_token', result.accessToken, {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
      path: '/',
      domain: config.COOKIE_DOMAIN,
    });

    response.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
      domain: config.COOKIE_DOMAIN,
    });

    return result.user;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout and clear session' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 200, description: 'Logout successful', type: LogoutResponseDto })
  @ApiResponse({ status: 401, description: 'Not authenticated', type: ProblemDetailsDto })
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.authService.logout(user.tenantId, user.id);

    response.clearCookie('access_token', { path: '/' });
    response.clearCookie('refresh_token', { path: '/' });

    return { success: true };
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 200, description: 'Current user', type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Not authenticated', type: ProblemDetailsDto })
  async me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getMe(user.id, user.tenantId);
  }
}
