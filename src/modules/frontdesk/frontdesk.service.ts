import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  VisitCheckIn,
  CheckInQueueStatus,
} from './entities/visit-check-in.entity';
import {
  AppointmentWaitlist,
  WaitlistStatus,
} from './entities/appointment-waitlist.entity';
import { Appointment, AppointmentStatus } from '../appointments/entities/appointment.entity';
import { PatientsService } from '../patients/patients.service';
import { UsersService } from '../users/users.service';
import {
  CheckInDto,
  CreateWaitlistDto,
  UpdateQueueStatusDto,
  UpdateWaitlistDto,
} from './dto/frontdesk.dto';

@Injectable()
export class FrontdeskService {
  constructor(
    @InjectRepository(VisitCheckIn) private readonly checkInRepo: Repository<VisitCheckIn>,
    @InjectRepository(AppointmentWaitlist) private readonly waitlistRepo: Repository<AppointmentWaitlist>,
    @InjectRepository(Appointment) private readonly apptRepo: Repository<Appointment>,
    private readonly patientsService: PatientsService,
    private readonly usersService: UsersService,
  ) {}

  private todayIso(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private deptPrefix(department: string): string {
    const d = (department || 'OPD').trim().toUpperCase();
    return d.slice(0, 1) || 'O';
  }

  private async nextToken(department: string, queueDate: string): Promise<string> {
    const prefix = this.deptPrefix(department);
    const rows = await this.checkInRepo
      .createQueryBuilder('c')
      .where('c.queueDate = :queueDate', { queueDate })
      .andWhere('c.department = :department', { department: department || 'OPD' })
      .orderBy('c.createdAt', 'DESC')
      .take(1)
      .getMany();

    let seq = 1;
    if (rows[0]?.tokenNumber) {
      const m = rows[0].tokenNumber.match(/-(\d+)$/);
      if (m) seq = parseInt(m[1], 10) + 1;
    }
    return `${prefix}-${String(seq).padStart(3, '0')}`;
  }

  async checkIn(dto: CheckInDto, createdByUserId?: string) {
    const queueDate = this.todayIso();
    let patientId = dto.patientId;
    let doctorId = dto.doctorId;
    let department = dto.department?.trim() || 'OPD';
    let appointment: Appointment | null = null;

    if (dto.appointmentId) {
      appointment = await this.apptRepo.findOne({
        where: { id: dto.appointmentId },
        relations: ['patient', 'doctor'],
      });
      if (!appointment) throw new NotFoundException('Appointment not found');
      patientId = appointment.patient.id;
      doctorId = appointment.doctor.id;
      department = appointment.department?.trim() || department;
    }

    if (!patientId) {
      throw new BadRequestException('patientId or appointmentId is required');
    }

    await this.patientsService.findById(patientId);
    if (doctorId) await this.usersService.findById(doctorId);

    const existing = await this.checkInRepo.findOne({
      where: {
        queueDate,
        patient: { id: patientId },
        status: CheckInQueueStatus.WAITING,
      },
    });
    if (existing) {
      return existing;
    }

    const tokenNumber = await this.nextToken(department, queueDate);
    const row = this.checkInRepo.create({
      tokenNumber,
      queueDate,
      department,
      status: CheckInQueueStatus.WAITING,
      appointment: appointment ? { id: appointment.id } : null,
      patient: { id: patientId },
      doctor: doctorId ? { id: doctorId } : null,
      checkedInAt: new Date(),
      createdBy: createdByUserId ? { id: createdByUserId } : null,
    });
    const saved = await this.checkInRepo.save(row);

    if (appointment && [AppointmentStatus.SCHEDULED].includes(appointment.status)) {
      appointment.status = AppointmentStatus.CONFIRMED;
      await this.apptRepo.save(appointment);
    }

    return this.checkInRepo.findOne({
      where: { id: saved.id },
      relations: ['patient', 'doctor', 'appointment'],
    });
  }

  async listQueue(queueDate?: string, department?: string, status?: string) {
    const date = queueDate || this.todayIso();
    const qb = this.checkInRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.patient', 'patient')
      .leftJoinAndSelect('c.doctor', 'doctor')
      .leftJoinAndSelect('c.appointment', 'appointment')
      .where('c.queueDate = :date', { date })
      .orderBy('c.createdAt', 'ASC');

    if (department) qb.andWhere('c.department = :department', { department });
    if (status) qb.andWhere('c.status = :status', { status });

    return qb.getMany();
  }

  async getKioskDisplay(queueDate?: string, department?: string) {
    const date = queueDate || this.todayIso();
    const waiting = await this.listQueue(date, department, CheckInQueueStatus.WAITING);
    const called = await this.checkInRepo.find({
      where: {
        queueDate: date,
        status: CheckInQueueStatus.CALLED,
        ...(department ? { department } : {}),
      },
      relations: ['patient'],
      order: { calledAt: 'DESC' },
      take: 3,
    });

    return {
      queueDate: date,
      department: department ?? 'ALL',
      nowServing: called.map((c) => ({
        token: c.tokenNumber,
        nameInitial: c.patient?.name?.charAt(0) ?? '?',
      })),
      waitingCount: waiting.length,
      upNext: waiting.slice(0, 8).map((c) => ({
        token: c.tokenNumber,
        status: c.status,
      })),
    };
  }

  async updateQueueStatus(id: string, dto: UpdateQueueStatusDto) {
    const row = await this.checkInRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Check-in not found');

    row.status = dto.status;
    const now = new Date();
    if (dto.status === CheckInQueueStatus.CALLED) row.calledAt = now;
    if (dto.status === CheckInQueueStatus.COMPLETED) row.completedAt = now;
    if (dto.status === CheckInQueueStatus.IN_SERVICE && !row.calledAt) row.calledAt = now;

    return this.checkInRepo.save(row);
  }

  async createWaitlist(dto: CreateWaitlistDto) {
    await this.patientsService.findById(dto.patientId);
    await this.usersService.findById(dto.doctorId);

    const row = this.waitlistRepo.create({
      patient: { id: dto.patientId },
      doctor: { id: dto.doctorId },
      department: dto.department?.trim() || null,
      preferredDate: dto.preferredDate ?? null,
      priority: dto.priority ?? 0,
      notes: dto.notes?.trim() || null,
      status: WaitlistStatus.WAITING,
    });
    return this.waitlistRepo.save(row);
  }

  async listWaitlist(status?: string, doctorId?: string) {
    const qb = this.waitlistRepo
      .createQueryBuilder('w')
      .leftJoinAndSelect('w.patient', 'patient')
      .leftJoinAndSelect('w.doctor', 'doctor')
      .orderBy('w.priority', 'DESC')
      .addOrderBy('w.createdAt', 'ASC');

    if (status) qb.andWhere('w.status = :status', { status });
    if (doctorId) qb.andWhere('w.doctor.id = :doctorId', { doctorId });

    return qb.getMany();
  }

  async updateWaitlist(id: string, dto: UpdateWaitlistDto) {
    const row = await this.waitlistRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Waitlist entry not found');
    if (dto.status) row.status = dto.status;
    if (dto.notes !== undefined) row.notes = dto.notes?.trim() || null;
    return this.waitlistRepo.save(row);
  }
}
