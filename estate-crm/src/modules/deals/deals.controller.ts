import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiCookieAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { DealsService } from './deals.service';
import { CreateDealDto } from './dto/create-deal.dto';
import { UpdateDealDto } from './dto/update-deal.dto';
import { DealFiltersDto } from './dto/deal-filters.dto';
import { ChangeDealStageDto } from './dto/change-deal-stage.dto';
import { AddActivityDto } from './dto/add-activity.dto';
import { ActivityFiltersDto } from './dto/activity-filters.dto';
import { AddTagDto } from './dto/add-tag.dto';
import {
  DealResponseDto,
  PaginatedDealResponseDto,
} from './dto/deal-response.dto';
import {
  DealActivityResponseDto,
  PaginatedDealActivityResponseDto,
} from './dto/activity-response.dto';
import { DealTagResponseDto } from './dto/tag-response.dto';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@/common/types/auth.types';

@ApiTags('Deals')
@Controller('deals')
export class DealsController {
  constructor(private readonly dealsService: DealsService) {}

  // ─── CRUD ───────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Create a deal' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 201, description: 'Deal created', type: DealResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error or invalid stage' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Agent not found' })
  async create(
    @Body() dto: CreateDealDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dealsService.create(dto, user.id, user.tenantId);
  }

  @Get()
  @ApiOperation({ summary: 'List deals with filters and pagination' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 200, description: 'Paginated deal list', type: PaginatedDealResponseDto })
  async findAll(
    @Query() filters: DealFiltersDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dealsService.findAll(filters, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get deal by ID' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 200, description: 'Deal details', type: DealResponseDto })
  @ApiResponse({ status: 404, description: 'Deal not found' })
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dealsService.findById(id, user.tenantId, user);
  }

  @Patch(':id')
  @Roles('admin', 'manager', 'agent')
  @ApiOperation({ summary: 'Update a deal' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 200, description: 'Updated deal', type: DealResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden (e.g., agent setting probability or value)' })
  @ApiResponse({ status: 404, description: 'Deal not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDealDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dealsService.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Soft delete a deal' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 200, description: 'Deal deleted', type: DealResponseDto })
  @ApiResponse({ status: 404, description: 'Deal not found' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dealsService.remove(id, user);
  }

  // ─── Stage FSM ──────────────────────────────────────────

  @Post(':id/stage')
  @HttpCode(HttpStatus.OK)
  @Roles('admin', 'manager', 'agent')
  @ApiOperation({ summary: 'Change deal stage (FSM transition)' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 200, description: 'Stage updated', type: DealResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid transition' })
  @ApiResponse({ status: 403, description: 'Agents cannot close as won' })
  @ApiResponse({ status: 404, description: 'Deal not found' })
  async changeStage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeDealStageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dealsService.changeStage(id, dto.stage, user);
  }

  // ─── Activities ─────────────────────────────────────────

  @Post(':id/activities')
  @HttpCode(HttpStatus.CREATED)
  @Roles('admin', 'manager', 'agent')
  @ApiOperation({ summary: 'Add an activity to a deal' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 201, description: 'Activity recorded', type: DealActivityResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Deal not found' })
  async addActivity(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddActivityDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dealsService.addActivity(id, dto, user);
  }

  @Get(':id/activities')
  @ApiOperation({ summary: 'List activities for a deal (paginated, sorted by createdAt DESC)' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 200, description: 'Paginated activities', type: PaginatedDealActivityResponseDto })
  @ApiResponse({ status: 404, description: 'Deal not found' })
  async findActivities(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() filters: ActivityFiltersDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dealsService.findActivities(id, filters, user);
  }

  // ─── Tags ───────────────────────────────────────────────

  @Get(':id/tags')
  @ApiOperation({ summary: 'List tags for a deal' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 200, description: 'Tags list', type: [DealTagResponseDto] })
  @ApiResponse({ status: 404, description: 'Deal not found' })
  async findTags(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dealsService.findTags(id, user.tenantId, user);
  }

  @Post(':id/tags')
  @HttpCode(HttpStatus.CREATED)
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Add a tag to a deal' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 201, description: 'Tag added', type: DealTagResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid color format' })
  @ApiResponse({ status: 404, description: 'Deal not found' })
  @ApiResponse({ status: 409, description: 'Tag already exists' })
  async addTag(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddTagDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dealsService.addTag(id, dto, user);
  }

  @Delete(':id/tags/:tagId')
  @HttpCode(HttpStatus.OK)
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Remove a tag from a deal' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 200, description: 'Tag removed' })
  @ApiResponse({ status: 404, description: 'Tag or deal not found' })
  async removeTag(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('tagId', ParseUUIDPipe) tagId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dealsService.removeTag(id, tagId, user);
  }

  // ─── Commission Preview (Stub) ──────────────────────────

  @Get(':id/commission-preview')
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Preview commission calculation for a deal (stub — Phase 9)' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 200, description: 'Commission preview (stub)' })
  @ApiResponse({ status: 404, description: 'Deal not found' })
  async commissionPreview(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dealsService.commissionPreview(id, user.tenantId, user);
  }
}
