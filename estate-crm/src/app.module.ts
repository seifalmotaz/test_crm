import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { AdminAuthModule } from './admin-auth/admin-auth.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { UsersModule } from './modules/users/users.module';
import { PropertiesModule } from './modules/properties/properties.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { LeadsModule } from './modules/leads/leads.module';
import { DealsModule } from './modules/deals/deals.module';

@Module({
  imports: [
    AuthModule,
    AdminAuthModule,
    OrganizationsModule,
    UsersModule,
    PropertiesModule,
    ProjectsModule,
    LeadsModule,
    DealsModule,
  ],
})
export class AppModule {}
