import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Appointment, AppointmentStatus, AppointmentType } from './entities/appointment.entity';
import { CreateAppointmentDto, RescheduleAppointmentDto } from './dto/create-appointment.dto';
import { PatientsService } from '../patients/patients.service';
import { UsersService } from '../users/users.service';
import { DoctorCredentialingService } from '../staff/doctor-credentialing.service';

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(Appointment) private repo: Repository<Appointment>,
    private patientsService: PatientsService,
    private usersService: UsersService,
    private credentialing: DoctorCredentialingService,
  ) {}

  async createForPatientUser(dto: CreateAppointmentDto, user: { id: string; email?: string }): Promise<Appointment> {
    const patient = await this.patientsService.findOwnedProfileByUser(user);
    if (dto.patientId !== patient.id) {
      throw new ForbiddenException('You can only book appointments for your own profile');
    }
    return this.create(dto);
  }

  async create(dto: CreateAppointmentDto): Promise<Appointment> {
    const patient = await this.patientsService.findById(dto.patientId);
    await this.credentialing.assertDoctorBookable(dto.doctorId);
    const doctor = await this.usersService.findById(dto.doctorId);
    // Slot conflict check
    const conflict = await this.repo.findOne({
      where: {
        doctor: { id: dto.doctorId },
        date: dto.date,
        time: dto.time,
        status: In([AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED]),
      },
    });
    if (conflict) throw new BadRequestException('Slot already booked for this doctor');
    const isTelevisit = dto.type === AppointmentType.TELEVISIT;
    const apt = this.repo.create({
      ...dto,
      patient,
      doctor,
      televisitUrl: isTelevisit ? (dto.televisitUrl ?? null) : null,
      televisitInstructions: isTelevisit ? (dto.televisitInstructions ?? null) : null,
    });
    const saved = await this.repo.save(apt);
    if (isTelevisit && !saved.televisitUrl) {
      const base = process.env.TELEVISIT_BASE_URL?.replace(/\/$/, '') ?? 'https://meet.hms.local/room';
      saved.televisitUrl = `${base}/${saved.id}`;
      if (!saved.televisitInstructions) {
        saved.televisitInstructions =
          'Join the video visit at the scheduled time using the link below. Ensure a stable connection and private setting.';
      }
      return this.repo.save(saved);
    }
    return saved;
  }

  async findAll(
    page = 1,
    limit = 20,
    date?: string,
    status?: string,
    doctorId?: string,
    patientId?: string,
    startDate?: string,
    endDate?: string,
  ) {
    const qb = this.repo.createQueryBuilder('apt')
      .leftJoinAndSelect('apt.patient', 'patient')
      .leftJoinAndSelect('apt.doctor', 'doctor')
      .orderBy('apt.date', 'ASC').addOrderBy('apt.time', 'ASC');

    if (startDate && endDate) {
      qb.andWhere('apt.date >= :startDate', { startDate }).andWhere('apt.date <= :endDate', { endDate });
    } else if (date) {
      qb.andWhere('apt.date = :date', { date });
    }
    if (status) qb.andWhere('apt.status = :status', { status });
    if (doctorId) qb.andWhere('doctor.id = :doctorId', { doctorId });
    if (patientId) qb.andWhere('patient.id = :patientId', { patientId });

    const rangeMode = Boolean(startDate && endDate);
    const take = rangeMode ? 500 : limit;
    const skip = rangeMode ? 0 : (page - 1) * take;

    const [data, total] = await qb.skip(skip).take(take).getManyAndCount();
    return { data, total, page: rangeMode ? 1 : page, pages: Math.ceil(total / take) || 1 };
  }

  async findById(id: string): Promise<Appointment> {
    const apt = await this.repo.findOne({ where: { id } });
    if (!apt) throw new NotFoundException(`Appointment ${id} not found`);
    return apt;
  }

  async findMineForPatient(user: { id: string; email?: string }) {
    const patient = await this.patientsService.findOwnedProfileByUser({ id: user.id, email: user.email });
    const limit = 50;
    const [data, total] = await this.repo.findAndCount({
      where: { patient: { id: patient.id } },
      order: { date: 'ASC', time: 'ASC' },
      take: limit,
    });
    return { data, total, page: 1, pages: Math.max(1, Math.ceil(total / limit)) };
  }

  async findOneForPatientUser(appointmentId: string, user: { id: string; email?: string }): Promise<Appointment> {
    const patient = await this.patientsService.findOwnedProfileByUser({ id: user.id, email: user.email });
    const apt = await this.repo.findOne({
      where: { id: appointmentId, patient: { id: patient.id } },
    });
    if (!apt) throw new NotFoundException(`Appointment ${appointmentId} not found`);
    return apt;
  }

  async reschedule(id: string, dto: RescheduleAppointmentDto): Promise<Appointment> {
    const current = await this.findById(id);
    await this.credentialing.assertDoctorBookable(current.doctor.id);
    const conflict = await this.repo.findOne({
      where: {
        doctor: { id: current.doctor.id },
        date: dto.date,
        time: dto.time,
        status: In([AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED]),
      },
    });
    if (conflict && conflict.id !== id) {
      throw new BadRequestException('Slot already booked for this doctor');
    }
    await this.repo.update(id, {
      date: dto.date,
      time: dto.time,
      notes: dto.reason ?? current.notes,
      status: AppointmentStatus.SCHEDULED,
    });
    return this.findById(id);
  }

  async updateStatus(id: string, status: AppointmentStatus): Promise<Appointment> {
    await this.findById(id);
    await this.repo.update(id, { status });
    return this.findById(id);
  }

  async cancel(id: string, reason?: string): Promise<Appointment> {
    await this.repo.update(id, { status: AppointmentStatus.CANCELLED, cancellationReason: reason });
    return this.findById(id);
  }

  async cancelForPatientUser(
    appointmentId: string,
    user: { id: string; email?: string },
    reason?: string,
  ): Promise<Appointment> {
    const apt = await this.findOneForPatientUser(appointmentId, user);
    if (![AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED].includes(apt.status)) {
      throw new BadRequestException('Only scheduled or confirmed visits can be cancelled');
    }
    return this.cancel(apt.id, reason);
  }

  async countToday(): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    return this.repo.count({ where: { date: today } });
  }
}
