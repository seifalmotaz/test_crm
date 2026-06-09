import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  ParseUUIDPipe,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiCookieAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { UserFiltersDto } from './dto/user-filters.dto';
import {
  UserResponseDto,
  UserCreatedResponseDto,
  PaginatedUserResponseDto,
  UserDeactivatedResponseDto,
} from './dto/user-response.dto';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@/common/types/auth.types';
import type { Request } from 'express';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List users' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 200, description: 'Paginated user list', type: PaginatedUserResponseDto })
  async findAll(
    @Query() filters: UserFiltersDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.findAll(filters, user);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Create user' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 201, description: 'User created', type: UserCreatedResponseDto })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  async create(
    @Body() dto: CreateUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.usersService.create(dto, user.id, user.tenantId);
    return { ...result.user, generatedPassword: result.generatedPassword };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 200, description: 'User details', type: UserResponseDto })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.findById(id, user.tenantId, user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 200, description: 'Updated user', type: UserResponseDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.update(id, dto, user.id, user.tenantId);
  }

  @Patch(':id/role')
  @ApiOperation({ summary: 'Change user role' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 200, description: 'Role changed', type: UserResponseDto })
  @ApiResponse({ status: 400, description: 'Cannot downgrade last admin' })
  async changeRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.changeRole(id, dto, user.id, user.tenantId);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate user (departure flow)' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 200, description: 'User deactivated with lead unassignment summary', type: UserDeactivatedResponseDto })
  @ApiResponse({ status: 400, description: 'Last admin / already inactive / self-deactivation' })
  async deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.usersService.deactivate(id, user.id, user.tenantId, ip as string, userAgent as string);
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reactivate departed user' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 200, description: 'User reactivated', type: UserResponseDto })
  async reactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.reactivate(id, user.id, user.tenantId);
  }
}