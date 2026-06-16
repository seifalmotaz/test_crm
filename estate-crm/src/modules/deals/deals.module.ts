import { Module } from '@nestjs/common';
import { DealsController } from './deals.controller';
import { DealsService } from './deals.service';
import { DealsActivitiesService } from './deals-activities.service';

@Module({
  controllers: [DealsController],
  providers: [DealsService, DealsActivitiesService],
})
export class DealsModule {}
