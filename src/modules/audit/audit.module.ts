import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditEvent } from './audit-event.entity';
import { HospitalAppSettings } from '../admin/entities/hospital-app-settings.entity';
import { DbAuditInterceptor } from './db-audit.interceptor';
import { AuditEventsService } from './audit-events.service';

@Module({
  imports: [TypeOrmModule.forFeature([AuditEvent, HospitalAppSettings])],
  providers: [
    AuditEventsService,
    DbAuditInterceptor,
    { provide: APP_INTERCEPTOR, useClass: DbAuditInterceptor },
  ],
  exports: [DbAuditInterceptor, AuditEventsService],
})
export class AuditModule {}
