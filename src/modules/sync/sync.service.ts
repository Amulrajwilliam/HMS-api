import { ForbiddenException, Injectable } from '@nestjs/common';
import { Role } from '../../common/enums/roles.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { EmrService } from '../emr/emr.service';
import { SyncQueueDto } from './sync.dto';

type SyncUser = { id: string; role: Role };

@Injectable()
export class SyncService {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly appointments: AppointmentsService,
    private readonly emr: EmrService,
  ) {}

  async processQueue(user: SyncUser, queue: SyncQueueDto) {
    const results: Array<{ eventId: string; status: 'synced' | 'failed'; reason?: string }> = [];

    for (const event of queue.events) {
      try {
        await this.dispatchEvent(user, event.module, event.action, event.payload);
        results.push({ eventId: event.eventId, status: 'synced' });
      } catch (error) {
        results.push({
          eventId: event.eventId,
          status: 'failed',
          reason: (error as Error).message,
        });
      }
    }

    return {
      deviceId: queue.deviceId,
      received: queue.events.length,
      synced: results.filter((r) => r.status === 'synced').length,
      failed: results.filter((r) => r.status === 'failed').length,
      results,
    };
  }

  private async dispatchEvent(
    user: SyncUser,
    module: string,
    action: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    if (module === 'notifications' && action === 'mark-read') {
      const id = String(payload.notificationId ?? '');
      if (!id) throw new Error('payload.notificationId is required');
      await this.notifications.markRead(id, user.id);
      return;
    }

    if (module === 'notifications' && action === 'mark-all-read') {
      await this.notifications.markAllRead(user.id);
      return;
    }

    if (module === 'appointments' && action === 'book') {
      if (![Role.ADMIN, Role.DOCTOR, Role.RECEPTIONIST].includes(user.role)) {
        throw new ForbiddenException('only staff can book appointments via sync');
      }
      const patientId = String(payload.patientId ?? '');
      const doctorId = String(payload.doctorId ?? '');
      const date = String(payload.date ?? '');
      const time = String(payload.time ?? '');
      if (!patientId || !doctorId || !date || !time) {
        throw new Error('payload must include patientId, doctorId, date, time');
      }
      await this.appointments.create({
        patientId,
        doctorId,
        date,
        time,
        type: payload.type as any,
        department: payload.department != null ? String(payload.department) : undefined,
        notes: payload.notes != null ? String(payload.notes) : undefined,
      });
      return;
    }

    if (module === 'emr' && action === 'create') {
      const patientId = String(payload.patientId ?? '');
      const doctorId = String(payload.doctorId ?? '');
      if (!patientId || !doctorId) throw new Error('payload must include patientId and doctorId');
      if (user.role === Role.DOCTOR || user.role === Role.NURSE) {
        if (doctorId !== user.id) {
          throw new ForbiddenException('doctorId must match the logged-in clinician');
        }
      } else if (user.role !== Role.ADMIN) {
        throw new ForbiddenException('only clinicians or admins can sync EMR creates');
      }
      await this.emr.create(payload as any);
      return;
    }

    throw new Error(`unsupported sync event: ${module}.${action}`);
  }
}
