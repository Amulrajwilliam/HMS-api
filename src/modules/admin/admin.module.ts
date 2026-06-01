import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { UsersModule } from '../users/users.module';
import { PatientsModule } from '../patients/patients.module';
import { AppointmentsModule } from '../appointments/appointments.module';
import { BillingModule } from '../billing/billing.module';
import { HospitalAppSettings } from './entities/hospital-app-settings.entity';
import { DoctorProfile } from '../staff/entities/doctor-profile.entity';
import { Department } from './entities/department.entity';
import { BillableService } from './entities/billable-service.entity';
import { AuditModule } from '../audit/audit.module';
import { DepartmentsService } from './departments.service';
import { BillableServicesService } from './billable-services.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([HospitalAppSettings, DoctorProfile, Department, BillableService]),
    UsersModule, PatientsModule, AppointmentsModule, BillingModule,
    AuditModule,
  ],
  providers: [AdminService, DepartmentsService, BillableServicesService],
  controllers: [AdminController],
  exports: [AdminService],
})
export class AdminModule {}
