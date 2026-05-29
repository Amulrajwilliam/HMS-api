import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MedicalReport } from './entities/medical-report.entity';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { ReportStorageService } from './report-storage.service';
import { PatientsModule } from '../patients/patients.module';

@Module({
  imports: [TypeOrmModule.forFeature([MedicalReport]), PatientsModule],
  controllers: [ReportsController],
  providers: [ReportsService, ReportStorageService],
  exports: [ReportsService],
})
export class ReportsModule {}
