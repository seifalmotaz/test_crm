import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiCookieAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UserFiltersDto } from './dto/user-filters.dto';
import { PaginatedUserResponseDto } from './dto/user-response.dto';
import { SuperAdminGuard } from '@/common/guards/super-admin.guard';

@ApiTags('Super Admin')
@Controller('admin/users')
@UseGuards(SuperAdminGuard)
export class UsersAdminController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List users across all tenants' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 200, description: 'Paginated cross-tenant user list', type: PaginatedUserResponseDto })
  async findAll(
    @Query() filters: UserFiltersDto,
  ) {
    // Pass a mock super admin actor to bypass tenant filtering
    return this.usersService.findAll(filters, { isSuperAdmin: true } as any);
  }
}