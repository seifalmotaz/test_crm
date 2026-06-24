import { Module } from '@nestjs/common';
import { CommissionPlansService } from './commission-plans/commission-plans.service';
import { CommissionPlansController } from './commission-plans/commission-plans.controller';
import { CommissionRecordsService } from './commission-records/commission-records.service';
import { CommissionRecordsController, AgentsCommissionsController } from './commission-records/commission-records.controller';

@Module({
  controllers: [CommissionPlansController, CommissionRecordsController, AgentsCommissionsController],
  providers: [CommissionPlansService, CommissionRecordsService],
  exports: [CommissionPlansService, CommissionRecordsService],
})
export class CommissionsModule {}
