import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth, ApiResponse } from '@nestjs/swagger';
import { OrganizationsService } from './organizations.service';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@/common/types/auth.types';

@ApiTags('Organization')
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current organization details' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 200, description: 'Organization details with user count' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  async getMyOrganization(@CurrentUser() user: AuthenticatedUser) {
    return this.organizationsService.findById(user.tenantId);
  }
}
