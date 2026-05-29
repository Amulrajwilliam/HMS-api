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

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NursingFlowsheetEntry,
      NursingCarePlan,
      NursingEwsScore,
      EmarAdministration,
    ]),
    PatientsModule,
  ],
  controllers: [NursingController],
  providers: [NursingService],
  exports: [NursingService],
})
export class NursingModule {}
