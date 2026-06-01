import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Appointment, AppointmentStatus } from '../appointments/entities/appointment.entity';
import {
  AppointmentWaitlist,
  WaitlistStatus,
} from './entities/appointment-waitlist.entity';
import {
  ReminderCampaignLog,
  ReminderCampaignType,
} from './entities/reminder-campaign-log.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationModule, NotificationType } from '../notifications/entities/notification.entity';
import { AdminService } from '../admin/admin.service';
import { normalizeHospitalSettings } from '../admin/hospital-settings.defaults';
import { PatientsService } from '../patients/patients.service';

@Injectable()
export class FrontdeskRemindersService {
  private readonly logger = new Logger(FrontdeskRemindersService.name);

  constructor(
    @InjectRepository(Appointment) private readonly apptRepo: Repository<Appointment>,
    @InjectRepository(AppointmentWaitlist) private readonly waitlistRepo: Repository<AppointmentWaitlist>,
    @InjectRepository(ReminderCampaignLog) private readonly logRepo: Repository<ReminderCampaignLog>,
    private readonly notifications: NotificationsService,
    private readonly adminService: AdminService,
    private readonly patientsService: PatientsService,
  ) {}

  private async settingsEnabled(key: keyof ReturnType<typeof normalizeHospitalSettings>['notifications']) {
    const { settings } = await this.adminService.getHospitalSettings();
    const n = normalizeHospitalSettings(settings).notifications;
    return Boolean(n[key]);
  }

  private addDays(isoDate: string, days: number): string {
    const d = new Date(isoDate + 'T12:00:00');
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  async runCampaign(
    campaignType: ReminderCampaignType,
    ranByUserId?: string,
  ): Promise<ReminderCampaignLog> {
    let recipientCount = 0;
    let skippedCount = 0;
    const metadata: Record<string, unknown> = { campaignType };

    if (campaignType === ReminderCampaignType.APPOINTMENT_TOMORROW) {
      const enabled = await this.settingsEnabled('appointmentReminders');
      if (!enabled) {
        skippedCount += 1;
        metadata.reason = 'appointmentReminders disabled in hospital settings';
      } else {
        const tomorrow = this.addDays(new Date().toISOString().slice(0, 10), 1);
        const appts = await this.apptRepo.find({
          where: {
            date: tomorrow,
            status: In([AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED]),
          },
          relations: ['patient', 'doctor'],
        });
        for (const a of appts) {
          const userId = await this.resolvePatientUserId(a.patient.id);
          if (!userId) {
            skippedCount += 1;
            continue;
          }
          await this.notifications.create({
            userId,
            title: 'Appointment reminder',
            message: `Reminder: visit with Dr. ${a.doctor?.name ?? 'doctor'} on ${a.date} at ${a.time}.`,
            type: NotificationType.INFO,
            module: NotificationModule.APPOINTMENTS,
            relatedId: a.id,
            actionUrl: `/appointments/${a.id}`,
          });
          recipientCount += 1;
        }
        metadata.targetDate = tomorrow;
        metadata.appointmentCount = appts.length;
      }
    } else if (campaignType === ReminderCampaignType.APPOINTMENT_DAY_OF) {
      const enabled = await this.settingsEnabled('appointmentReminders');
      if (!enabled) {
        skippedCount += 1;
        metadata.reason = 'appointmentReminders disabled';
      } else {
        const today = new Date().toISOString().slice(0, 10);
        const appts = await this.apptRepo.find({
          where: {
            date: today,
            status: In([AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED]),
          },
          relations: ['patient', 'doctor'],
        });
        for (const a of appts) {
          const userId = await this.resolvePatientUserId(a.patient.id);
          if (!userId) {
            skippedCount += 1;
            continue;
          }
          await this.notifications.create({
            userId,
            title: 'Visit today',
            message: `You have an appointment today at ${a.time} with Dr. ${a.doctor?.name ?? 'doctor'}. Please check in at reception.`,
            type: NotificationType.INFO,
            module: NotificationModule.APPOINTMENTS,
            relatedId: a.id,
          });
          recipientCount += 1;
        }
        metadata.targetDate = today;
      }
    } else if (campaignType === ReminderCampaignType.WAITLIST_SLOT) {
      const rows = await this.waitlistRepo.find({
        where: { status: In([WaitlistStatus.WAITING, WaitlistStatus.NOTIFIED]) },
        relations: ['patient', 'doctor'],
        take: 100,
      });
      for (const w of rows) {
        const userId = await this.resolvePatientUserId(w.patient.id);
        if (!userId) {
          skippedCount += 1;
          continue;
        }
        await this.notifications.create({
          userId,
          title: 'Waitlist update',
          message: `A slot may be opening with Dr. ${w.doctor?.name ?? 'doctor'}. Contact reception to book.`,
          type: NotificationType.INFO,
          module: NotificationModule.APPOINTMENTS,
          relatedId: w.id,
        });
        w.status = WaitlistStatus.NOTIFIED;
        w.lastNotifiedAt = new Date();
        await this.waitlistRepo.save(w);
        recipientCount += 1;
      }
      metadata.waitlistCount = rows.length;
    }

    return this.logRepo.save(
      this.logRepo.create({
        campaignType,
        recipientCount,
        skippedCount,
        metadata,
        ranBy: ranByUserId ? { id: ranByUserId } : null,
      }),
    );
  }

  private async resolvePatientUserId(patientId: string): Promise<string | null> {
    try {
      const p = await this.patientsService.findById(patientId);
      return p.userId ?? null;
    } catch {
      return null;
    }
  }

  async notifyWaitlistEntry(waitlistId: string) {
    const w = await this.waitlistRepo.findOne({
      where: { id: waitlistId },
      relations: ['patient', 'doctor'],
    });
    if (!w) throw new NotFoundException('Waitlist entry not found');
    const userId = await this.resolvePatientUserId(w.patient.id);
    if (!userId) {
      return { notified: false, reason: 'Patient has no portal user linked' };
    }
    await this.notifications.create({
      userId,
      title: 'Waitlist — slot available',
      message: `Please contact reception regarding Dr. ${w.doctor?.name ?? 'doctor'}.`,
      type: NotificationType.INFO,
      module: NotificationModule.APPOINTMENTS,
      relatedId: w.id,
    });
    w.status = WaitlistStatus.NOTIFIED;
    w.lastNotifiedAt = new Date();
    await this.waitlistRepo.save(w);
    return { notified: true, waitlistId: w.id };
  }

  async listLogs(page = 1, limit = 20) {
    const [data, total] = await this.logRepo.findAndCount({
      relations: ['ranBy'],
      order: { ranAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, pages: Math.ceil(total / limit) || 1 };
  }

  /** Optional hourly auto-run when enabled (MVP — no separate cron package). */
  startAutoCampaignLoop() {
    const hourMs = 60 * 60 * 1000;
    setInterval(() => {
      void this.runCampaign(ReminderCampaignType.APPOINTMENT_TOMORROW).catch((e) =>
        this.logger.warn(`auto appointment reminder failed: ${(e as Error).message}`),
      );
    }, hourMs);
    this.logger.log('Front desk reminder auto-loop started (hourly tomorrow campaign)');
  }
}
