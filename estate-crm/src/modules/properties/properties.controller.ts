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
import { PropertiesService } from './properties.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { PropertyFiltersDto } from './dto/property-filters.dto';
import { ChangePropertyStatusDto } from './dto/change-property-status.dto';
import { MediaUploadDto } from './dto/media-upload.dto';
import {
  PropertyResponseDto,
  PaginatedPropertyResponseDto,
} from './dto/property-response.dto';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@/common/types/auth.types';

@ApiTags('Properties')
@Controller('properties')
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Create a property' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 201, description: 'Property created', type: PropertyResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error or invalid attributes' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Project or agent not found' })
  async create(
    @Body() dto: CreatePropertyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.propertiesService.create(dto, user.id, user.tenantId);
  }

  @Get()
  @ApiOperation({ summary: 'List properties with filters and pagination' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 200, description: 'Paginated property list', type: PaginatedPropertyResponseDto })
  async findAll(
    @Query() filters: PropertyFiltersDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.propertiesService.findAll(filters, user.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get property by ID' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 200, description: 'Property details', type: PropertyResponseDto })
  @ApiResponse({ status: 404, description: 'Property not found' })
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.propertiesService.findById(id, user.tenantId);
  }

  @Patch(':id')
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Update a property' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 200, description: 'Updated property', type: PropertyResponseDto })
  @ApiResponse({ status: 404, description: 'Property not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePropertyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.propertiesService.update(id, dto, user.tenantId);
  }

  @Post(':id/status')
  @HttpCode(HttpStatus.OK)
  @Roles('admin')
  @ApiOperation({ summary: 'Change property status (FSM transition)' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 200, description: 'Status updated', type: PropertyResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid transition' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangePropertyStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.propertiesService.changeStatus(id, dto.status, user.tenantId);
  }

  @Post(':id/media')
  @HttpCode(HttpStatus.OK)
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Generate a pre-signed upload URL for property media' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 200, description: 'Pre-signed upload URL generated' })
  @ApiResponse({ status: 404, description: 'Property not found' })
  async getPresignedUploadUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MediaUploadDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.propertiesService.getPresignedUploadUrl(id, dto.filename, dto.contentType, user.tenantId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Soft delete a property' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 200, description: 'Property deleted', type: PropertyResponseDto })
  @ApiResponse({ status: 404, description: 'Property not found' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.propertiesService.remove(id, user.tenantId);
  }
}