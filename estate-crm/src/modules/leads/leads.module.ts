import { Module } from '@nestjs/common';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { LeadsActivitiesService } from './leads-activities.service';

@Module({
  controllers: [LeadsController],
  providers: [LeadsService, LeadsActivitiesService],
})
export class LeadsModule {}
