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
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiCookieAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationFiltersDto } from './dto/organization-filters.dto';
import { SuperAdminGuard } from '@/common/guards/super-admin.guard';

@ApiTags('Super Admin')
@Controller('admin/organizations')
@UseGuards(SuperAdminGuard)
export class OrganizationsAdminController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  @ApiOperation({ summary: 'List all organizations' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 200, description: 'Paginated list of organizations' })
  async findAll(@Query() filters: OrganizationFiltersDto) {
    return this.organizationsService.findAll(filters);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create organization with initial admin' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 201, description: 'Organization created' })
  @ApiResponse({ status: 409, description: 'Slug or email already exists' })
  async create(@Body() dto: CreateOrganizationDto) {
    return this.organizationsService.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get organization by ID' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 200, description: 'Organization details' })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.organizationsService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update organization' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 200, description: 'Updated organization' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.organizationsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete organization (hard delete, cascades)' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 204, description: 'Organization deleted' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.organizationsService.delete(id);
  }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Activate organization' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 200, description: 'Organization activated' })
  async activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.organizationsService.activate(id);
  }

  @Post(':id/suspend')
  @ApiOperation({ summary: 'Suspend organization' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 200, description: 'Organization suspended' })
  async suspend(@Param('id', ParseUUIDPipe) id: string) {
    return this.organizationsService.suspend(id);
  }
}
