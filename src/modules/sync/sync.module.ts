import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { AppointmentsModule } from '../appointments/appointments.module';
import { EmrModule } from '../emr/emr.module';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

@Module({
  imports: [NotificationsModule, AppointmentsModule, EmrModule],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
