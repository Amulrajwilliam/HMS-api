import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../../common/enums/roles.enum';
import { createReadStream, existsSync } from 'fs';
import { Readable } from 'stream';
import { mkdir, writeFile } from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { UsersService } from '../users/users.service';
import { PatientsService } from '../patients/patients.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { BillingService } from '../billing/billing.service';
import { HospitalAppSettings } from './entities/hospital-app-settings.entity';
import { DoctorProfile } from '../staff/entities/doctor-profile.entity';
import { Department } from './entities/department.entity';
import { PatchHospitalSettingsDto } from './dto/patch-hospital-settings.dto';
import { UpsertDoctorProfileDto } from './dto/upsert-doctor-profile.dto';
import { normalizeHospitalSettings } from './hospital-settings.defaults';
import { mapDoctorProfileToJson } from '../staff/staff.service';

const SINGLETON_ID = 'singleton';

const BRANDING_DIR = path.join(process.cwd(), 'uploads', 'hospital-branding');

const BRANDING_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/svg+xml',
  'image/webp',
  'image/x-icon',
  'image/vnd.microsoft.icon',
]);

export function isSafeBrandingFileName(name: string): boolean {
  return /^br-(logo|favicon)-[0-9a-f-]{36}\.[a-z0-9]{1,8}$/i.test(name);
}

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(HospitalAppSettings) private readonly hospitalSettingsRepo: Repository<HospitalAppSettings>,
    @InjectRepository(DoctorProfile) private readonly doctorProfileRepo: Repository<DoctorProfile>,
    @InjectRepository(Department) private readonly departmentRepo: Repository<Department>,
    private usersService: UsersService,
    private patientsService: PatientsService,
    private appointmentsService: AppointmentsService,
    private billingService: BillingService,
  ) {}

  async getDashboardStats() {
    const [totalPatients, todayAppointments, totalUsers, revenueSummary] = await Promise.all([
      this.patientsService.count(),
      this.appointmentsService.countToday(),
      this.usersService.count(),
      this.billingService.getRevenueSummary(),
    ]);

    return {
      totalPatients,
      todayAppointments,
      totalUsers,
      totalRevenue: Number(revenueSummary?.totalRevenue ?? 0),
      outstanding: Number(revenueSummary?.outstanding ?? 0),
      totalInvoices: Number(revenueSummary?.totalInvoices ?? 0),
    };
  }

  async getHospitalSettings() {
    let row = await this.hospitalSettingsRepo.findOne({ where: { id: SINGLETON_ID } });
    if (!row) {
      row = this.hospitalSettingsRepo.create({
        id: SINGLETON_ID,
        settings: normalizeHospitalSettings({}),
      });
      await this.hospitalSettingsRepo.save(row);
    }
    const settings = normalizeHospitalSettings(row.settings);
    return { settings, updatedAt: row.updatedAt };
  }

  async updateHospitalSettings(dto: PatchHospitalSettingsDto) {
    let row = await this.hospitalSettingsRepo.findOne({ where: { id: SINGLETON_ID } });
    if (!row) {
      row = this.hospitalSettingsRepo.create({ id: SINGLETON_ID, settings: {} });
    }
    const base = normalizeHospitalSettings(row.settings);
    const nextDraft = {
      general: dto.general !== undefined ? { ...base.general, ...dto.general } : base.general,
      branding: dto.branding !== undefined ? { ...base.branding, ...dto.branding } : base.branding,
      notifications:
        dto.notifications !== undefined ? { ...base.notifications, ...dto.notifications } : base.notifications,
      security: dto.security !== undefined ? { ...base.security, ...dto.security } : base.security,
    };
    const next = normalizeHospitalSettings(nextDraft);
    row.settings = next as unknown as Record<string, unknown>;
    await this.hospitalSettingsRepo.save(row);
    return { settings: normalizeHospitalSettings(row.settings), updatedAt: row.updatedAt };
  }

  async getPublicBranding() {
    const row = await this.hospitalSettingsRepo.findOne({ where: { id: SINGLETON_ID } });
    const settings = normalizeHospitalSettings(row?.settings ?? {});
    return {
      general: { hospitalName: settings.general.hospitalName ?? '' },
      branding: {
        primaryColor: settings.branding.primaryColor,
        secondaryColor: settings.branding.secondaryColor,
        logoUrl: settings.branding.logoUrl ?? '',
        faviconUrl: settings.branding.faviconUrl ?? '',
        appTitle: settings.branding.appTitle ?? '',
      },
      updatedAt: row?.updatedAt?.toISOString?.() ?? null,
    };
  }

  private brandingFsPath(fileName: string): string {
    if (!isSafeBrandingFileName(fileName)) {
      throw new BadRequestException('Invalid file name');
    }
    return path.join(BRANDING_DIR, fileName);
  }

  async readBrandingAsset(fileName: string): Promise<{ stream: Readable; contentType: string }> {
    const full = this.brandingFsPath(fileName);
    if (!existsSync(full)) throw new NotFoundException('Asset not found');
    const ext = path.extname(full).slice(1).toLowerCase();
    const contentType =
      ext === 'png'
        ? 'image/png'
        : ext === 'jpg' || ext === 'jpeg'
          ? 'image/jpeg'
          : ext === 'svg'
            ? 'image/svg+xml'
            : ext === 'webp'
              ? 'image/webp'
              : ext === 'ico'
                ? 'image/x-icon'
                : 'application/octet-stream';
    return { stream: createReadStream(full), contentType };
  }

  /** Saves an uploaded image and writes a portable `/api/v1/...` path into hospital settings. */
  async uploadBrandingAsset(
    kind: 'logo' | 'favicon',
    file: Express.Multer.File | undefined,
  ): Promise<{
    urlPath: string;
    settings: ReturnType<typeof normalizeHospitalSettings>;
    updatedAt?: Date;
  }> {
    if (!file?.buffer?.length) throw new BadRequestException('File is required');
    const mime = (file.mimetype || '').toLowerCase();
    if (!BRANDING_MIMES.has(mime)) {
      throw new BadRequestException(`Unsupported file type: ${mime || 'unknown'}`);
    }
    if (file.size > 2 * 1024 * 1024) throw new BadRequestException('File too large (max 2MB)');

    const extFromMime: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/svg+xml': 'svg',
      'image/webp': 'webp',
      'image/x-icon': 'ico',
      'image/vnd.microsoft.icon': 'ico',
    };
    const ext = extFromMime[mime] ?? 'bin';
    if (ext === 'bin') throw new BadRequestException('Unsupported file type for branding upload');
    const fileName = `br-${kind}-${randomUUID()}.${ext}`;
    await mkdir(BRANDING_DIR, { recursive: true });
    const full = path.join(BRANDING_DIR, fileName);
    await writeFile(full, file.buffer);

    const urlPath = `/api/v1/admin/hospital-settings/branding-assets/${fileName}`;

    let row = await this.hospitalSettingsRepo.findOne({ where: { id: SINGLETON_ID } });
    if (!row) {
      row = this.hospitalSettingsRepo.create({ id: SINGLETON_ID, settings: {} });
    }
    const cur = normalizeHospitalSettings(row.settings);
    const key = kind === 'logo' ? 'logoUrl' : 'faviconUrl';
    const next = normalizeHospitalSettings({
      ...cur,
      branding: { ...cur.branding, [key]: urlPath },
    });
    row.settings = next as unknown as Record<string, unknown>;
    await this.hospitalSettingsRepo.save(row);
    return {
      urlPath,
      settings: normalizeHospitalSettings(row.settings),
      updatedAt: row.updatedAt,
    };
  }

  /** Admin-only: read doctor user + optional directory profile. */
  async getDoctorProfile(userId: string) {
    const user = await this.usersService.findById(userId);
    if (user.role !== Role.DOCTOR) {
      throw new BadRequestException('Only users with role doctor have a doctor directory profile');
    }
    const profile = await this.doctorProfileRepo.findOne({
      where: { userId },
      relations: ['departmentRef'],
    });
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      profile: profile ? mapDoctorProfileToJson(profile) : null,
    };
  }

  /** Admin-only: create or patch directory / credentialing fields for a doctor user. */
  async upsertDoctorProfile(userId: string, dto: UpsertDoctorProfileDto) {
    const user = await this.usersService.findById(userId);
    if (user.role !== Role.DOCTOR) {
      throw new BadRequestException('Only users with role doctor can have a doctor profile');
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
    if (dto.employeeId !== undefined) profile.employeeId = optStr(dto.employeeId);
    if (dto.designation !== undefined) profile.designation = optStr(dto.designation);
    if (dto.clinicalPhone !== undefined) profile.clinicalPhone = optStr(dto.clinicalPhone);

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

    if (dto.credentialingStatus !== undefined) {
      const prev = profile.credentialingStatus;
      profile.credentialingStatus = dto.credentialingStatus;
      if (dto.credentialingStatus !== prev) {
        profile.credentialingReviewedAt = new Date();
      }
    }
    if (dto.credentialingNotes !== undefined) {
      profile.credentialingNotes = optStr(dto.credentialingNotes);
    }

    await this.doctorProfileRepo.save(profile);
    const saved = await this.doctorProfileRepo.findOneOrFail({
      where: { userId },
      relations: ['departmentRef'],
    });
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      profile: mapDoctorProfileToJson(saved),
    };
  }
}
