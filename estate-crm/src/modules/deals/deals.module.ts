import { Module } from '@nestjs/common';
import { DealsController } from './deals.controller';
import { DealsService } from './deals.service';
import { DealsActivitiesService } from './deals-activities.service';
import { CommissionsModule } from '@/modules/commissions/commissions.module';

@Module({
  imports: [CommissionsModule],
  controllers: [DealsController],
  providers: [DealsService, DealsActivitiesService],
})
export class DealsModule {}
