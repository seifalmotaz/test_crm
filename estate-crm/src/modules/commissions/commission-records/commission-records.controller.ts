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
import { CommissionRecordsService } from './commission-records.service';
import { CommissionRecordFiltersDto } from './dto/commission-record-filters.dto';
import { CommissionSummaryFiltersDto } from './dto/commission-summary.dto';
import {
  CommissionRecordResponseDto,
  PaginatedCommissionRecordResponseDto,
} from './dto/commission-record-response.dto';
import { CommissionSummaryResponseDto } from './dto/commission-summary.dto';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@/common/types/auth.types';

@ApiTags('Commission Records')
@Controller('commission-records')
export class CommissionRecordsController {
  constructor(private readonly commissionRecordsService: CommissionRecordsService) {}

  @Get()
  @Roles('admin', 'manager', 'agent')
  @ApiOperation({ summary: 'List commission records with filters and pagination' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 200, description: 'Paginated commission record list', type: PaginatedCommissionRecordResponseDto })
  async findAll(
    @Query() filters: CommissionRecordFiltersDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.commissionRecordsService.list(user.tenantId, user, filters);
  }

  @Get('summary')
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Get commission summary (aggregated totals)' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 200, description: 'Commission summary', type: CommissionSummaryResponseDto })
  async summary(
    @Query() filters: CommissionSummaryFiltersDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.commissionRecordsService.summary(user.tenantId, filters);
  }

  @Get(':id')
  @Roles('admin', 'manager', 'agent')
  @ApiOperation({ summary: 'Get commission record by ID' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 200, description: 'Commission record details', type: CommissionRecordResponseDto })
  @ApiResponse({ status: 404, description: 'Commission record not found' })
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.commissionRecordsService.findById(user.tenantId, id, user);
  }
}

@ApiTags('Agents')
@Controller('agents')
export class AgentsCommissionsController {
  constructor(private readonly commissionRecordsService: CommissionRecordsService) {}

  @Get(':id/commissions')
  @Roles('admin', 'manager', 'agent')
  @ApiOperation({ summary: 'List commission records for a specific agent' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 200, description: 'Paginated commission records for agent', type: PaginatedCommissionRecordResponseDto })
  async findAgentCommissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() filters: CommissionRecordFiltersDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.commissionRecordsService.list(user.tenantId, user, {
      ...filters,
      agentId: id,
    });
  }
}
