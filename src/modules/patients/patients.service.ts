import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, FindManyOptions, QueryFailedError } from 'typeorm';
import { Patient, PatientStatus, Gender } from './entities/patient.entity';
import { User } from '../users/entities/user.entity';
import { Role } from '../../common/enums/roles.enum';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';

@Injectable()
export class PatientsService {
  constructor(
    @InjectRepository(Patient) private repo: Repository<Patient>,
    @InjectRepository(User) private userRepo: Repository<User>,
  ) {}

  private async generateUhid(): Promise<string> {
    const count = await this.repo.count({ withDeleted: true });
    return `UHID-${String(count + 1).padStart(4, '0')}`;
  }

  /** Picks a 10-digit Indian-style mobile not already used by a patient. */
  private async allocateUniquePatientPhone(): Promise<string> {
    for (let offset = 0; offset < 9000; offset++) {
      const phone = String(9876540000 + offset);
      const taken = await this.repo.exists({ where: { phone } });
      if (!taken) return phone;
    }
    throw new ConflictException('Could not allocate a unique phone number for new patient record.');
  }

  /**
   * When a PATIENT user has no `patients` row (common if seed skipped the demo row), create one.
   */
  private async provisionPatientForPortalUser(userId: string): Promise<Patient | null> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ['id', 'name', 'email', 'role'],
    });
    if (!user || user.role !== Role.PATIENT || !user.email?.trim()) {
      return null;
    }

    let again = await this.repo.findOne({ where: { userId: user.id } });
    if (again) return again;

    const emailNorm = user.email.trim().toLowerCase();
    again = await this.repo
      .createQueryBuilder('p')
      .where('LOWER(TRIM(p.email)) = :email', { email: emailNorm })
      .getOne();
    if (again) {
      if (!again.userId) {
        await this.repo.update(again.id, { userId: user.id });
        again.userId = user.id;
      }
      return again.userId === user.id ? again : null;
    }

    const demoPhone = '9876543216';
    const byPhone = await this.repo.findOne({ where: { phone: demoPhone } });
    if (byPhone && (!byPhone.userId || byPhone.userId === user.id)) {
      await this.repo.update(byPhone.id, { email: emailNorm, userId: user.id, name: byPhone.name || user.name });
      return this.repo.findOne({ where: { id: byPhone.id } });
    }

    const uhid = await this.generateUhid();
    const phone = !byPhone ? demoPhone : await this.allocateUniquePatientPhone();
    const row = this.repo.create({
      name: user.name,
      dob: '1990-01-01',
      gender: Gender.MALE,
      phone,
      email: emailNorm,
      userId: user.id,
      uhid,
    });
    try {
      return await this.repo.save(row);
    } catch {
      return this.repo.findOne({ where: { userId: user.id } });
    }
  }

  async create(dto: CreatePatientDto): Promise<Patient> {
    const uhid = await this.generateUhid();
    const patient = this.repo.create({ ...dto, uhid });
    return this.repo.save(patient);
  }

  async findAll(search?: string, status?: string, page = 1, limit = 20) {
    const where: FindManyOptions<Patient>['where'] = {};
    if (status && status !== 'all') where.status = status as PatientStatus;

    const [data, total] = await this.repo.findAndCount({
      where: search ? [
        { ...where, name: Like(`%${search}%`) },
        { ...where, uhid: Like(`%${search}%`) },
        { ...where, phone: Like(`%${search}%`) },
      ] : where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const enriched = await Promise.all(
      data.map(async (p) => ({
        ...p,
        portalLoginEmail: await this.findPortalLoginEmailForPatient(p),
      })),
    );

    return { data: enriched, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findById(id: string): Promise<Patient> {
    const p = await this.repo.findOne({ where: { id } });
    if (!p) throw new NotFoundException(`Patient ${id} not found`);
    return p;
  }

  async findByUhid(uhid: string): Promise<Patient> {
    const p = await this.repo.findOne({ where: { uhid } });
    if (!p) throw new NotFoundException(`Patient ${uhid} not found`);
    return p;
  }

  /** All patient record IDs visible to this portal login (userId link + matching email). */
  async findPortalPatientIds(currentUser: { id?: string; email?: string }): Promise<string[]> {
    const ids = new Set<string>();
    if (currentUser.id) {
      const byUserId = await this.repo.find({ where: { userId: currentUser.id }, select: ['id'] });
      byUserId.forEach((p) => ids.add(p.id));
    }
    const emailNorm = currentUser.email?.trim().toLowerCase();
    if (emailNorm) {
      const byEmail = await this.repo
        .createQueryBuilder('p')
        .where('LOWER(TRIM(p.email)) = :email', { email: emailNorm })
        .select(['p.id'])
        .getMany();
      byEmail.forEach((p) => ids.add(p.id));
    }
    return [...ids];
  }

  /** Email used to sign in to the patient app for this chart, if any. */
  async findPortalLoginEmailForPatient(patient: Patient): Promise<string | null> {
    if (patient.userId) {
      const u = await this.userRepo.findOne({ where: { id: patient.userId }, select: ['email'] });
      return u?.email ?? null;
    }
    if (!patient.email?.trim()) return null;
    const emailNorm = patient.email.trim().toLowerCase();
    const u = await this.userRepo
      .createQueryBuilder('u')
      .where('LOWER(TRIM(u.email)) = :email', { email: emailNorm })
      .andWhere('u.role = :role', { role: Role.PATIENT })
      .getOne();
    return u?.email ?? null;
  }

  /**
   * Links `patients.userId` when the chart email matches a portal user (role patient).
   * Skips if the portal user is already linked to a different chart.
   */
  async linkPortalUserForPatient(patientId: string): Promise<void> {
    const patient = await this.findById(patientId);
    if (patient.userId) return;
    if (!patient.email?.trim()) return;

    const emailNorm = patient.email.trim().toLowerCase();
    const portalUser = await this.userRepo
      .createQueryBuilder('u')
      .where('LOWER(TRIM(u.email)) = :email', { email: emailNorm })
      .andWhere('u.role = :role', { role: Role.PATIENT })
      .getOne();
    if (!portalUser) return;

    const existing = await this.repo.findOne({ where: { userId: portalUser.id } });
    if (existing && existing.id !== patient.id) return;

    await this.repo.update(patient.id, { userId: portalUser.id });
  }

  /**
   * Resolves the Patient row for a portal user: by `userId`, else by email (case-insensitive).
   * If a row matches email but `userId` is still null, links it once (same idea as seed backfill).
   */
  async findOwnedProfileByUser(currentUser: { id?: string; email?: string }): Promise<Patient> {
    if (!currentUser?.id && !currentUser?.email) {
      throw new NotFoundException('Patient profile not linked to current user');
    }

    let patient: Patient | null = null;
    if (currentUser.id) {
      patient = await this.repo.findOne({ where: { userId: currentUser.id } });
    }

    if (!patient && currentUser.email?.trim()) {
      const normalized = currentUser.email.trim().toLowerCase();
      patient = await this.repo
        .createQueryBuilder('p')
        .where('LOWER(TRIM(p.email)) = :email', { email: normalized })
        .getOne();
    }

    if (!patient && currentUser.id) {
      patient = await this.provisionPatientForPortalUser(currentUser.id);
    }

    if (!patient) {
      throw new NotFoundException(
        'Patient profile not found for current user. For portal access, use an account with role patient and a matching patient record (or restart the API so seed can create one).',
      );
    }

    if (patient.userId && currentUser.id && patient.userId !== currentUser.id) {
      throw new ForbiddenException('This patient profile is linked to a different account.');
    }

    if (!patient.userId && currentUser.id) {
      await this.repo.update(patient.id, { userId: currentUser.id });
      patient.userId = currentUser.id;
    }

    return patient;
  }

  async updateOwnedProfile(
    currentUser: { id: string; email?: string },
    dto: UpdatePatientDto,
  ): Promise<Patient> {
    const patient = await this.findOwnedProfileByUser(currentUser);
    const patch: UpdatePatientDto = {
      phone: dto.phone,
      address: dto.address,
      emergencyName: dto.emergencyName,
      emergencyPhone: dto.emergencyPhone,
      emergencyRelation: dto.emergencyRelation,
      allergies: dto.allergies,
    };
    return this.update(patient.id, patch);
  }

  async update(id: string, dto: UpdatePatientDto): Promise<Patient> {
    const patient = await this.findById(id);

    const keys: (keyof UpdatePatientDto)[] = [
      'name', 'dob', 'gender', 'bloodGroup', 'phone', 'email', 'userId',
      'address', 'emergencyName', 'emergencyPhone', 'emergencyRelation',
      'allergies', 'notes',
    ];

    const p = patient as unknown as Record<string, unknown>;
    for (const k of keys) {
      const v = dto[k];
      if (v !== undefined) {
        p[k as string] = v;
      }
    }

    try {
      return await this.repo.save(patient);
    } catch (e) {
      if (e instanceof QueryFailedError) {
        const d = e.driverError as { code?: string } | undefined;
        if (d?.code === '23505') {
          throw new ConflictException(
            'Duplicate value: phone, email, or linked user is already used by another patient.',
          );
        }
      }
      throw e;
    }
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.repo.softDelete(id);
  }

  async count(): Promise<number> {
    return this.repo.count();
  }
}
