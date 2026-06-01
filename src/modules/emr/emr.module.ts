import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmrRecord } from './entities/emr-record.entity';
import { PatientAllergy } from '../patients/entities/patient-allergy.entity';
import { Patient } from '../patients/entities/patient.entity';
import { EmrService } from './emr.service';
import { EmrController } from './emr.controller';
import { PatientsModule } from '../patients/patients.module';
import { UsersModule } from '../users/users.module';
import { PharmacyModule } from '../pharmacy/pharmacy.module';
import { AdtModule } from '../adt/adt.module';
import { Appointment } from '../appointments/entities/appointment.entity';
import { NursingModule } from '../nursing/nursing.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([EmrRecord, PatientAllergy, Patient, Appointment]),
    PatientsModule,
    UsersModule,
    PharmacyModule,
    AdtModule,
    NursingModule,
  ],
  providers: [EmrService],
  controllers: [EmrController],
  exports: [EmrService],
})
export class EmrModule {}
