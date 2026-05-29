import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from '../billing/entities/invoice.entity';
import { Patient } from '../patients/entities/patient.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { EmrRecord } from '../emr/entities/emr-record.entity';
import { BillingModule } from '../billing/billing.module';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsExportProcessor, ANALYTICS_EXPORT_QUEUE } from './analytics-export.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invoice, Patient, Appointment, EmrRecord]),
    BillingModule,
    BullModule.registerQueue({ name: ANALYTICS_EXPORT_QUEUE }),
  ],
  providers: [AnalyticsService, AnalyticsExportProcessor],
  controllers: [AnalyticsController],
})
export class AnalyticsModule {}
