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
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { ClientFiltersDto } from './dto/client-filters.dto';
import { SetVipDto } from './dto/set-vip.dto';
import { AddActivityDto } from '@/modules/leads/dto/add-activity.dto';
import { ActivityFiltersDto } from '@/modules/leads/dto/activity-filters.dto';
import { AddTagDto } from '@/modules/leads/dto/add-tag.dto';
import {
  LeadResponseDto,
  PaginatedLeadResponseDto,
} from '@/modules/leads/dto/lead-response.dto';
import {
  LeadActivityResponseDto,
  PaginatedLeadActivityResponseDto,
} from '@/modules/leads/dto/activity-response.dto';
import { LeadTagResponseDto } from '@/modules/leads/dto/tag-response.dto';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@/common/types/auth.types';

@ApiTags('Clients')
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  // ─── CRUD ───────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('admin', 'manager', 'agent')
  @ApiOperation({ summary: 'Create a client (creates a lead with isClient=true)' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 201, description: 'Client created', type: LeadResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Agent not found' })
  async create(
    @Body() dto: CreateClientDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clientsService.create(dto, user.id, user.tenantId);
  }

  @Get()
  @ApiOperation({ summary: 'List clients (leads with isClient=true)' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 200, description: 'Paginated client list', type: PaginatedLeadResponseDto })
  async findAll(
    @Query() filters: ClientFiltersDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clientsService.findAll(filters, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get client by ID (returns 400 if not a client)' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 200, description: 'Client details', type: LeadResponseDto })
  @ApiResponse({ status: 400, description: 'Not a client' })
  @ApiResponse({ status: 404, description: 'Client not found' })
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clientsService.findById(id, user.tenantId, user);
  }

  @Patch(':id')
  @Roles('admin', 'manager', 'agent')
  @ApiOperation({ summary: 'Update a client' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 200, description: 'Updated client', type: LeadResponseDto })
  @ApiResponse({ status: 400, description: 'Not a client' })
  @ApiResponse({ status: 403, description: 'Forbidden (e.g., agent setting VIP or lifetimeValue)' })
  @ApiResponse({ status: 404, description: 'Client not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClientDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clientsService.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Soft delete a client' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 200, description: 'Client deleted', type: LeadResponseDto })
  @ApiResponse({ status: 400, description: 'Not a client' })
  @ApiResponse({ status: 404, description: 'Client not found' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clientsService.remove(id, user);
  }

  // ─── VIP ────────────────────────────────────────────────

  @Post(':id/vip')
  @HttpCode(HttpStatus.OK)
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Set or clear VIP flag on a client (manager/admin only)' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 200, description: 'VIP status updated', type: LeadResponseDto })
  @ApiResponse({ status: 400, description: 'Not a client' })
  @ApiResponse({ status: 403, description: 'Forbidden (agent)' })
  @ApiResponse({ status: 404, description: 'Client not found' })
  async setVip(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetVipDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clientsService.setVip(id, dto, user);
  }

  // ─── Activities ─────────────────────────────────────────

  @Post(':id/activities')
  @HttpCode(HttpStatus.CREATED)
  @Roles('admin', 'manager', 'agent')
  @ApiOperation({ summary: 'Add an activity to a client' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 201, description: 'Activity recorded', type: LeadActivityResponseDto })
  @ApiResponse({ status: 400, description: 'Not a client' })
  @ApiResponse({ status: 404, description: 'Client not found' })
  async addActivity(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddActivityDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clientsService.addActivity(id, dto, user);
  }

  @Get(':id/activities')
  @ApiOperation({ summary: 'List activities for a client (paginated)' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 200, description: 'Paginated activities', type: PaginatedLeadActivityResponseDto })
  @ApiResponse({ status: 400, description: 'Not a client' })
  @ApiResponse({ status: 404, description: 'Client not found' })
  async findActivities(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() filters: ActivityFiltersDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clientsService.findActivities(id, filters, user);
  }

  // ─── Tags ───────────────────────────────────────────────

  @Get(':id/tags')
  @ApiOperation({ summary: 'List tags for a client' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 200, description: 'Tags list', type: [LeadTagResponseDto] })
  @ApiResponse({ status: 400, description: 'Not a client' })
  @ApiResponse({ status: 404, description: 'Client not found' })
  async findTags(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clientsService.findTags(id, user.tenantId, user);
  }

  @Post(':id/tags')
  @HttpCode(HttpStatus.CREATED)
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Add a tag to a client' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 201, description: 'Tag added', type: LeadTagResponseDto })
  @ApiResponse({ status: 400, description: 'Not a client' })
  @ApiResponse({ status: 409, description: 'Tag already exists' })
  async addTag(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddTagDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clientsService.addTag(id, dto, user);
  }

  @Delete(':id/tags/:tagId')
  @HttpCode(HttpStatus.OK)
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Remove a tag from a client' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 200, description: 'Tag removed' })
  @ApiResponse({ status: 400, description: 'Not a client' })
  @ApiResponse({ status: 404, description: 'Tag or client not found' })
  async removeTag(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('tagId', ParseUUIDPipe) tagId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clientsService.removeTag(id, tagId, user);
  }
}
