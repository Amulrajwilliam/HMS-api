import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Patient } from './entities/patient.entity';
import { PatientProblem } from './entities/patient-problem.entity';
import { PatientAllergy } from './entities/patient-allergy.entity';
import { User } from '../users/entities/user.entity';
import { PatientsService } from './patients.service';
import { PatientClinicalService } from './patient-clinical.service';
import { PatientsController } from './patients.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Patient, PatientProblem, PatientAllergy, User])],
  providers: [PatientsService, PatientClinicalService],
  controllers: [PatientsController],
  exports: [PatientsService, PatientClinicalService],
})
export class PatientsModule {}
