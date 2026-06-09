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
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectFiltersDto } from './dto/project-filters.dto';
import { ChangeProjectStatusDto } from './dto/change-project-status.dto';
import {
  ProjectResponseDto,
  PaginatedProjectResponseDto,
} from './dto/project-response.dto';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@/common/types/auth.types';

@ApiTags('Projects')
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Create a project' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 201, description: 'Project created', type: ProjectResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async create(
    @Body() dto: CreateProjectDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectsService.create(dto, user.id, user.tenantId);
  }

  @Get()
  @ApiOperation({ summary: 'List projects with filters and pagination' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 200, description: 'Paginated project list', type: PaginatedProjectResponseDto })
  async findAll(
    @Query() filters: ProjectFiltersDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectsService.findAll(filters, user.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project by ID' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 200, description: 'Project details', type: ProjectResponseDto })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectsService.findById(id, user.tenantId);
  }

  @Patch(':id')
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Update a project' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 200, description: 'Updated project', type: ProjectResponseDto })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectsService.update(id, dto, user.tenantId);
  }

  @Post(':id/status')
  @HttpCode(HttpStatus.OK)
  @Roles('admin')
  @ApiOperation({ summary: 'Change project status (FSM transition)' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 200, description: 'Status updated', type: ProjectResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid transition' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeProjectStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectsService.changeStatus(id, dto.status, user.tenantId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Soft delete a project' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 200, description: 'Project deleted', type: ProjectResponseDto })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectsService.remove(id, user.tenantId);
  }
}