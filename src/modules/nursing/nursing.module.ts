import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  EmarAdministration,
  NursingCarePlan,
  NursingEwsScore,
  NursingFlowsheetEntry,
} from './entities/nursing-chart.entity';
import { NursingService } from './nursing.service';
import { NursingController } from './nursing.controller';
import { PatientsModule } from '../patients/patients.module';
import { PharmacyModule } from '../pharmacy/pharmacy.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdtModule } from '../adt/adt.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NursingFlowsheetEntry,
      NursingCarePlan,
      NursingEwsScore,
      EmarAdministration,
    ]),
    PatientsModule,
    PharmacyModule,
    NotificationsModule,
    AdtModule,
  ],
  controllers: [NursingController],
  providers: [NursingService],
  exports: [NursingService],
})
export class NursingModule {}
