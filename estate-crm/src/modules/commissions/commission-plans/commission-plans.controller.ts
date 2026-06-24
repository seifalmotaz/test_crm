import {
  Controller,
  Get,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiCookieAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { CommissionPlansService } from './commission-plans.service';
import { CommissionPlanFiltersDto } from './dto/commission-plan-filters.dto';
import {
  CommissionPlanResponseDto,
  PaginatedCommissionPlanResponseDto,
} from './dto/commission-plan-response.dto';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@/common/types/auth.types';

@ApiTags('Commission Plans')
@Controller('commission-plans')
export class CommissionPlansController {
  constructor(private readonly commissionPlansService: CommissionPlansService) {}

  @Get()
  @Roles('admin', 'manager', 'agent')
  @ApiOperation({ summary: 'List commission plans with filters and pagination' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 200, description: 'Paginated commission plan list', type: PaginatedCommissionPlanResponseDto })
  async findAll(
    @Query() filters: CommissionPlanFiltersDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.commissionPlansService.findAll(user.tenantId, filters);
  }

  @Get('default')
  @Roles('admin', 'manager', 'agent')
  @ApiOperation({ summary: 'Get the default commission plan for the tenant' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 200, description: 'Default commission plan or null', type: CommissionPlanResponseDto })
  async findDefault(@CurrentUser() user: AuthenticatedUser) {
    return this.commissionPlansService.findDefaultForTenant(user.tenantId);
  }

  @Get(':id')
  @Roles('admin', 'manager', 'agent')
  @ApiOperation({ summary: 'Get commission plan by ID' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 200, description: 'Commission plan details', type: CommissionPlanResponseDto })
  @ApiResponse({ status: 404, description: 'Commission plan not found' })
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.commissionPlansService.findById(user.tenantId, id);
  }
}
