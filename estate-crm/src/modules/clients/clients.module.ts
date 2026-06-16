import { Module } from '@nestjs/common';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import { LeadsModule } from '@/modules/leads/leads.module';

@Module({
  imports: [LeadsModule],
  controllers: [ClientsController],
  providers: [ClientsService],
})
export class ClientsModule {}
