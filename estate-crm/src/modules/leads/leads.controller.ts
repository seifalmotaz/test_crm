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
import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { LeadFiltersDto } from './dto/lead-filters.dto';
import { ChangeLeadStageDto } from './dto/change-lead-stage.dto';
import { ConvertLeadDto } from './dto/convert-lead.dto';
import { SetDncDto } from './dto/set-dnc.dto';
import { AddActivityDto } from './dto/add-activity.dto';
import { ActivityFiltersDto } from './dto/activity-filters.dto';
import { AddTagDto } from './dto/add-tag.dto';
import {
  LeadResponseDto,
  PaginatedLeadResponseDto,
} from './dto/lead-response.dto';
import {
  LeadActivityResponseDto,
  PaginatedLeadActivityResponseDto,
} from './dto/activity-response.dto';
import { LeadTagResponseDto } from './dto/tag-response.dto';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@/common/types/auth.types';

@ApiTags('Leads')
@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  // ─── CRUD ───────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Create a lead' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 201, description: 'Lead created', type: LeadResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error or invalid stage' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Agent not found' })
  async create(
    @Body() dto: CreateLeadDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsService.create(dto, user.id, user.tenantId);
  }

  @Get()
  @ApiOperation({ summary: 'List leads with filters and pagination' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 200, description: 'Paginated lead list', type: PaginatedLeadResponseDto })
  async findAll(
    @Query() filters: LeadFiltersDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsService.findAll(filters, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get lead by ID' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 200, description: 'Lead details', type: LeadResponseDto })
  @ApiResponse({ status: 404, description: 'Lead not found' })
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsService.findById(id, user.tenantId, user);
  }

  @Patch(':id')
  @Roles('admin', 'manager', 'agent')
  @ApiOperation({ summary: 'Update a lead' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 200, description: 'Updated lead', type: LeadResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden (e.g., agent setting score)' })
  @ApiResponse({ status: 404, description: 'Lead or agent not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLeadDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsService.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Soft delete a lead' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 200, description: 'Lead deleted', type: LeadResponseDto })
  @ApiResponse({ status: 404, description: 'Lead not found' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsService.remove(id, user);
  }

  // ─── Stage FSM ──────────────────────────────────────────

  @Post(':id/stage')
  @HttpCode(HttpStatus.OK)
  @Roles('admin', 'manager', 'agent')
  @ApiOperation({ summary: 'Change lead stage (FSM transition)' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 200, description: 'Stage updated', type: LeadResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid transition' })
  @ApiResponse({ status: 404, description: 'Lead not found' })
  async changeStage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeLeadStageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsService.changeStage(id, dto.stage, user);
  }

  // ─── Conversion ─────────────────────────────────────────

  @Post(':id/convert')
  @HttpCode(HttpStatus.OK)
  @Roles('admin', 'manager', 'agent')
  @ApiOperation({ summary: 'Convert lead to client (sets isConverted=true, no new record created)' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 200, description: 'Lead converted', type: LeadResponseDto })
  @ApiResponse({ status: 400, description: 'Already converted or not assigned' })
  @ApiResponse({ status: 404, description: 'Lead not found' })
  async convert(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() _dto: ConvertLeadDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsService.convert(id, user);
  }

  // ─── DNC ────────────────────────────────────────────────

  @Post(':id/dnc')
  @HttpCode(HttpStatus.OK)
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Set or clear Do-Not-Contact flag' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 200, description: 'DNC updated', type: LeadResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden (agent)' })
  @ApiResponse({ status: 404, description: 'Lead not found' })
  async setDnc(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetDncDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsService.setDnc(id, dto, user);
  }

  // ─── Activities ─────────────────────────────────────────

  @Post(':id/activities')
  @HttpCode(HttpStatus.CREATED)
  @Roles('admin', 'manager', 'agent')
  @ApiOperation({ summary: 'Add an activity to a lead (rejected if DNC is active)' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 201, description: 'Activity recorded', type: LeadActivityResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 403, description: 'Forbidden (DNC active)' })
  @ApiResponse({ status: 404, description: 'Lead not found' })
  async addActivity(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddActivityDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsService.addActivity(id, dto, user);
  }

  @Get(':id/activities')
  @ApiOperation({ summary: 'List activities for a lead (paginated, sorted by createdAt DESC)' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 200, description: 'Paginated activities', type: PaginatedLeadActivityResponseDto })
  @ApiResponse({ status: 404, description: 'Lead not found' })
  async findActivities(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() filters: ActivityFiltersDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsService.findActivities(id, filters, user);
  }

  // ─── Tags ───────────────────────────────────────────────

  @Get(':id/tags')
  @ApiOperation({ summary: 'List tags for a lead' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 200, description: 'Tags list', type: [LeadTagResponseDto] })
  @ApiResponse({ status: 404, description: 'Lead not found' })
  async findTags(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsService.findTags(id, user.tenantId, user);
  }

  @Post(':id/tags')
  @HttpCode(HttpStatus.CREATED)
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Add a tag to a lead' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 201, description: 'Tag added', type: LeadTagResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid color format' })
  @ApiResponse({ status: 404, description: 'Lead not found' })
  @ApiResponse({ status: 409, description: 'Tag already exists' })
  async addTag(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddTagDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsService.addTag(id, dto, user);
  }

  @Delete(':id/tags/:tagId')
  @HttpCode(HttpStatus.OK)
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Remove a tag from a lead' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 200, description: 'Tag removed' })
  @ApiResponse({ status: 404, description: 'Tag or lead not found' })
  async removeTag(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('tagId', ParseUUIDPipe) tagId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsService.removeTag(id, tagId, user);
  }
}
