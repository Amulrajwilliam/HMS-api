import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { VisitCheckIn } from './entities/visit-check-in.entity';
import { AppointmentWaitlist } from './entities/appointment-waitlist.entity';
import { ReminderCampaignLog } from './entities/reminder-campaign-log.entity';
import { PatientMergeLog } from './entities/patient-merge-log.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { Patient } from '../patients/entities/patient.entity';
import { FrontdeskService } from './frontdesk.service';
import { FrontdeskRemindersService } from './frontdesk-reminders.service';
import { FrontdeskMpiService } from './frontdesk-mpi.service';
import { FrontdeskController } from './frontdesk.controller';
import { PatientsModule } from '../patients/patients.module';
import { UsersModule } from '../users/users.module';
import { AppointmentsModule } from '../appointments/appointments.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      VisitCheckIn,
      AppointmentWaitlist,
      ReminderCampaignLog,
      PatientMergeLog,
      Appointment,
      Patient,
    ]),
    PatientsModule,
    UsersModule,
    AppointmentsModule,
    NotificationsModule,
    AdminModule,
  ],
  controllers: [FrontdeskController],
  providers: [FrontdeskService, FrontdeskRemindersService, FrontdeskMpiService],
  exports: [FrontdeskService],
})
export class FrontdeskModule implements OnModuleInit {
  constructor(
    private readonly reminders: FrontdeskRemindersService,
    private readonly cfg: ConfigService,
  ) {}

  onModuleInit() {
    if (this.cfg.get('FRONTDESK_AUTO_REMINDERS') === 'true') {
      this.reminders.startAutoCampaignLoop();
    }
  }
}
