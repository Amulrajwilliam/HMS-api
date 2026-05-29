import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { DoctorProfile } from './entities/doctor-profile.entity';
import { Department } from '../admin/entities/department.entity';
import { DoctorCredentialingService } from './doctor-credentialing.service';
import { UsersService } from '../users/users.service';
import { PatchDoctorSelfProfileDto } from './dto/patch-doctor-self-profile.dto';
import { Role } from '../../common/enums/roles.enum';
import {
  generateTemplateSlots,
  mergeBookedIntoSlots,
  DEFAULT_CLINIC_START,
  DEFAULT_CLINIC_END,
  DEFAULT_SLOT_MINUTES,
  DEFAULT_WORKING_DAYS,
} from './doctor-schedule.util';

export function mapDoctorProfileToJson(p: DoctorProfile) {
  const d = p.departmentRef;
  return {
    id: p.id,
    medicalRegistrationNo: p.medicalRegistrationNo,
    registrationExpiry: p.registrationExpiry
      ? new Date(p.registrationExpiry).toISOString().slice(0, 10)
      : null,
    specialties: p.specialties,
    qualification: p.qualification,
    department: p.department,
    departmentId: p.departmentId,
    departmentCode: d?.code ?? null,
    departmentName: d?.name ?? null,
    credentialingStatus: p.credentialingStatus,
    credentialingNotes: p.credentialingNotes,
    credentialingReviewedAt: p.credentialingReviewedAt
      ? new Date(p.credentialingReviewedAt).toISOString()
      : null,
    consultationFee:
      p.consultationFee !== null && p.consultationFee !== undefined
        ? Number(p.consultationFee)
        : null,
    languages: p.languages,
    bio: p.bio,
    employeeId: p.employeeId,
    designation: p.designation,
    clinicalPhone: p.clinicalPhone,
    clinicStartTime: p.clinicStartTime ?? DEFAULT_CLINIC_START,
    clinicEndTime: p.clinicEndTime ?? DEFAULT_CLINIC_END,
    slotDurationMinutes: p.slotDurationMinutes ?? DEFAULT_SLOT_MINUTES,
    workingDays: p.workingDays ?? DEFAULT_WORKING_DAYS,
    updatedAt: p.updatedAt?.toISOString?.() ?? undefined,
  };
}

@Injectable()
export class StaffService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Appointment) private aptRepo: Repository<Appointment>,
    @InjectRepository(DoctorProfile) private doctorProfileRepo: Repository<DoctorProfile>,
    @InjectRepository(Department) private departmentRepo: Repository<Department>,
    private usersService: UsersService,
    private credentialing: DoctorCredentialingService,
  ) {}

  async getMyDoctorProfile(userId: string) {
    const user = await this.usersService.findById(userId);
    if (user.role !== Role.DOCTOR) {
      throw new BadRequestException('Only doctors have a directory profile');
    }
    const profile = await this.doctorProfileRepo.findOne({
      where: { userId },
      relations: ['departmentRef'],
    });
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      profile: profile ? mapDoctorProfileToJson(profile) : null,
    };
  }

  async patchMyDoctorProfile(userId: string, dto: PatchDoctorSelfProfileDto) {
    const user = await this.usersService.findById(userId);
    if (user.role !== Role.DOCTOR) {
      throw new BadRequestException('Only doctors can update a doctor directory profile');
    }

    let profile = await this.doctorProfileRepo.findOne({ where: { userId } });
    if (!profile) {
      profile = this.doctorProfileRepo.create({ userId });
    }

    const optStr = (v: string | undefined): string | null => {
      if (v === undefined) return null;
      const t = v.trim();
      return t.length ? t : null;
    };

    if (dto.medicalRegistrationNo !== undefined) {
      profile.medicalRegistrationNo = optStr(dto.medicalRegistrationNo);
    }
    if (dto.registrationExpiry !== undefined) {
      profile.registrationExpiry = dto.registrationExpiry
        ? new Date(`${dto.registrationExpiry}T12:00:00Z`)
        : null;
    }
    if (dto.specialties !== undefined) profile.specialties = optStr(dto.specialties);
    if (dto.qualification !== undefined) profile.qualification = optStr(dto.qualification);
    if (dto.department !== undefined) profile.department = optStr(dto.department);
    if (dto.languages !== undefined) profile.languages = optStr(dto.languages);
    if (dto.bio !== undefined) profile.bio = optStr(dto.bio);
    if (dto.designation !== undefined) profile.designation = optStr(dto.designation);
    if (dto.clinicalPhone !== undefined) profile.clinicalPhone = optStr(dto.clinicalPhone);
    if (dto.clinicStartTime !== undefined) profile.clinicStartTime = dto.clinicStartTime.trim() || DEFAULT_CLINIC_START;
    if (dto.clinicEndTime !== undefined) profile.clinicEndTime = dto.clinicEndTime.trim() || DEFAULT_CLINIC_END;
    if (dto.slotDurationMinutes !== undefined) {
      const n = Math.round(Number(dto.slotDurationMinutes));
      if (Number.isNaN(n) || n < 15 || n > 120) {
        throw new BadRequestException('slotDurationMinutes must be between 15 and 120');
      }
      profile.slotDurationMinutes = n;
    }
    if (dto.workingDays !== undefined) profile.workingDays = dto.workingDays.trim() || DEFAULT_WORKING_DAYS;

    if (dto.consultationFee !== undefined) {
      const n = Number(dto.consultationFee);
      if (Number.isNaN(n) || n < 0) {
        throw new BadRequestException('consultationFee must be a non-negative number');
      }
      profile.consultationFee = n.toFixed(2);
    }

    if (dto.departmentId !== undefined) {
      if (dto.departmentId === null) {
        profile.departmentId = null;
      } else {
        const dept = await this.departmentRepo.findOne({
          where: { id: dto.departmentId, isActive: true },
        });
        if (!dept) throw new BadRequestException('Invalid or inactive department');
        profile.departmentId = dto.departmentId;
      }
    }

    const saved = await this.doctorProfileRepo.save(profile);
    const withDept = await this.doctorProfileRepo.findOne({
      where: { id: saved.id },
      relations: ['departmentRef'],
    });
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      profile: withDept ? mapDoctorProfileToJson(withDept) : null,
    };
  }

  /**
   * Active doctors with optional 1:1 directory profile (admin fills via PATCH /admin/doctor-profiles/:userId).
   * Backward compatible: same id/name/email/role plus `profile` object or null.
   */
  async getDoctors(bookableOnly = false) {
    const rows = await this.userRepo.find({
      where: { role: Role.DOCTOR, isActive: true },
      order: { name: 'ASC' },
      relations: ['doctorProfile', 'doctorProfile.departmentRef'],
    });
    const filtered = bookableOnly
      ? rows.filter((u) => this.credentialing.isBookableProfile(u.doctorProfile))
      : rows;
    return filtered.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      profile: u.doctorProfile ? mapDoctorProfileToJson(u.doctorProfile) : null,
    }));
  }

  /** Return all staff (excluding patients) */
  async getAll() {
    return this.userRepo.find({
      where: { isActive: true },
      order: { name: 'ASC' },
      select: ['id', 'name', 'email', 'role', 'isActive', 'createdAt'],
    });
  }

  /** Return upcoming appointments for a doctor */
  async getDoctorSchedule(doctorId: string, date?: string) {
    const qb = this.aptRepo
      .createQueryBuilder('apt')
      .leftJoinAndSelect('apt.patient', 'patient')
      .where('apt.doctorId = :doctorId', { doctorId })
      .orderBy('apt.date', 'ASC')
      .addOrderBy('apt.time', 'ASC');

    if (date) {
      qb.andWhere('apt.date = :date', { date });
    } else {
      const today = new Date().toISOString().split('T')[0];
      qb.andWhere('apt.date >= :today', { today });
    }

    return qb.take(50).getMany();
  }

  /** Template slots for a day merged with booked appointments. */
  async getDoctorAvailability(doctorId: string, date: string) {
    const day = date?.slice(0, 10) || new Date().toISOString().split('T')[0];
    await this.usersService.findById(doctorId);

    let profile = await this.doctorProfileRepo.findOne({ where: { userId: doctorId } });
    if (!profile) {
      profile = this.doctorProfileRepo.create({
        userId: doctorId,
        clinicStartTime: DEFAULT_CLINIC_START,
        clinicEndTime: DEFAULT_CLINIC_END,
        slotDurationMinutes: DEFAULT_SLOT_MINUTES,
        workingDays: DEFAULT_WORKING_DAYS,
      });
      await this.doctorProfileRepo.save(profile);
    }

    const template = generateTemplateSlots(
      day,
      profile.clinicStartTime,
      profile.clinicEndTime,
      profile.slotDurationMinutes,
      profile.workingDays,
    );

    const booked = await this.aptRepo.find({
      where: { doctor: { id: doctorId }, date: day as any },
      relations: ['patient'],
      order: { time: 'ASC' },
    });

    const slots = mergeBookedIntoSlots(
      template,
      booked.map((a) => ({
        id: a.id,
        time: String(a.time),
        status: a.status,
        type: a.type,
        patient: a.patient ? { name: a.patient.name } : undefined,
      })),
    );

    return {
      doctorId,
      date: day,
      clinicStartTime: profile.clinicStartTime,
      clinicEndTime: profile.clinicEndTime,
      slotDurationMinutes: profile.slotDurationMinutes,
      workingDays: profile.workingDays,
      slots,
      availableCount: slots.filter((s) => s.status === 'available').length,
      bookedCount: slots.filter((s) => s.status === 'booked').length,
    };
  }
}
