import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmrRecord } from './entities/emr-record.entity';
import { Appointment, AppointmentStatus } from '../appointments/entities/appointment.entity';
import { PatientAllergy, AllergyStatus } from '../patients/entities/patient-allergy.entity';
import { Patient } from '../patients/entities/patient.entity';
import { CreateEmrDto } from './dto/create-emr.dto';
import { RecordVitalsDto } from './dto/record-vitals.dto';
import { PatientsService } from '../patients/patients.service';
import { UsersService } from '../users/users.service';
import { PharmacyService } from '../pharmacy/pharmacy.service';
import { AdtService } from '../adt/adt.service';
import { NursingService } from '../nursing/nursing.service';
import { ClinicalTimelineItem } from '../nursing/nursing-timeline.types';
import { COMMON_ICD10 } from './data/icd10-common';
import { checkDrugInteractions } from './data/drug-interactions-common';
import { Role } from '../../common/enums/roles.enum';

@Injectable()
export class EmrService {
  constructor(
    @InjectRepository(EmrRecord) private repo: Repository<EmrRecord>,
    @InjectRepository(PatientAllergy) private allergyRepo: Repository<PatientAllergy>,
    @InjectRepository(Patient) private patientRepo: Repository<Patient>,
    @InjectRepository(Appointment) private appointmentRepo: Repository<Appointment>,
    private patientsService: PatientsService,
    private usersService: UsersService,
    private pharmacyService: PharmacyService,
    private adtService: AdtService,
    private nursingService: NursingService,
  ) {}

  async create(dto: CreateEmrDto, currentUser?: { id?: string; role?: string }): Promise<EmrRecord> {
    if (currentUser?.role === Role.DOCTOR) {
      if (!currentUser.id || dto.doctorId !== currentUser.id) {
        throw new ForbiddenException('doctorId must match the logged-in doctor');
      }
    }
    const { icdCodes, appointmentId, ...rest } = dto;
    let diagnosis = rest.diagnosis;
    if (icdCodes?.length) {
      const prefix = `[ICD ${icdCodes.join('; ')}]`;
      diagnosis = diagnosis ? `${prefix} ${diagnosis}` : prefix;
    }
    const patient = await this.patientsService.findById(rest.patientId);
    const doctor = await this.usersService.findById(rest.doctorId);
    const record = this.repo.create({
      ...rest,
      diagnosis,
      patient,
      doctor,
      appointment: appointmentId ? { id: appointmentId } as any : undefined,
    });
    const saved = await this.repo.save(record);
    if (rest.prescriptions?.length) {
      await this.pharmacyService.queueFromEmrPrescriptions({
        sourceEmrRecordId: saved.id,
        patientId: patient.id,
        doctorId: doctor.id,
        prescriptions: rest.prescriptions,
      });
    }
    return saved;
  }

  /** Resolves attending doctor for a vitals EMR row (outpatient-friendly). */
  private async resolveAttendingDoctorId(
    patientId: string,
    user: { id: string; role?: string },
  ): Promise<string> {
    if (user.role === Role.DOCTOR) {
      return user.id;
    }

    const admission = await this.adtService.findActiveAdmissionForPatient(patientId);
    if (admission?.admittingDoctor?.id) {
      return admission.admittingDoctor.id;
    }

    const lastEmr = await this.repo.findOne({
      where: { patient: { id: patientId } },
      order: { createdAt: 'DESC' },
      relations: ['doctor'],
    });
    if (lastEmr?.doctor?.id) {
      return lastEmr.doctor.id;
    }

    const apt = await this.appointmentRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.doctor', 'doctor')
      .leftJoin('a.patient', 'patient')
      .where('patient.id = :patientId', { patientId })
      .andWhere('a.status IN (:...statuses)', {
        statuses: [
          AppointmentStatus.SCHEDULED,
          AppointmentStatus.CONFIRMED,
          AppointmentStatus.COMPLETED,
        ],
      })
      .orderBy('a.date', 'DESC')
      .addOrderBy('a.time', 'DESC')
      .getOne();
    if (apt?.doctor?.id) {
      return apt.doctor.id;
    }

    throw new BadRequestException(
      'Could not determine an attending doctor. Book a visit, add an EMR note, admit the patient, or sign in as the doctor.',
    );
  }

  async createVitals(
    user: { id: string; role?: string },
    dto: RecordVitalsDto,
  ): Promise<EmrRecord> {
    const hasAny =
      dto.bloodPressure != null ||
      dto.temperature != null ||
      dto.weight != null ||
      dto.height != null ||
      dto.pulseRate != null ||
      dto.oxygenSaturation != null ||
      dto.respiratoryRate != null;
    if (!hasAny) {
      throw new BadRequestException('Provide at least one vital sign.');
    }

    const doctorId = await this.resolveAttendingDoctorId(dto.patientId, user);
    const roleLabel = user.role ?? 'staff';

    const createDto: CreateEmrDto = {
      patientId: dto.patientId,
      doctorId,
      bloodPressure: dto.bloodPressure,
      temperature: dto.temperature,
      weight: dto.weight,
      height: dto.height,
      pulseRate: dto.pulseRate,
      oxygenSaturation: dto.oxygenSaturation,
      respiratoryRate: dto.respiratoryRate,
      notes: `Vitals recorded by ${roleLabel} (${user.id})`,
    };
    return this.create(createDto, user);
  }

  /** @deprecated Use createVitals */
  async createNurseVitals(nurseUserId: string, dto: RecordVitalsDto): Promise<EmrRecord> {
    return this.createVitals({ id: nurseUserId, role: Role.NURSE }, dto);
  }

  async checkPrescriptionInteractions(drugs: string[], patientId?: string) {
    const allergySubstances: string[] = [];
    if (patientId) {
      const rows = await this.allergyRepo.find({
        where: { patientId, status: AllergyStatus.ACTIVE },
      });
      allergySubstances.push(...rows.map((r) => r.substance));
      const patient = await this.patientRepo.findOne({ where: { id: patientId } });
      if (patient?.allergies?.trim()) {
        patient.allergies.split(/[,;]/).forEach((s) => {
          const t = s.trim();
          if (t) allergySubstances.push(t);
        });
      }
    }
    return checkDrugInteractions(drugs, allergySubstances);
  }

  searchIcd10(q: string, limit = 25) {
    const needle = (q ?? '').trim().toLowerCase();
    if (!needle) {
      return COMMON_ICD10.slice(0, limit);
    }
    const hits = COMMON_ICD10.filter(
      (row) =>
        row.code.toLowerCase().includes(needle) ||
        row.description.toLowerCase().includes(needle),
    );
    return hits.slice(0, limit);
  }

  async getEmrTimeline(patientId: string, take = 50) {
    const rows = await this.repo.find({
      where: { patient: { id: patientId } },
      order: { createdAt: 'DESC' },
      take: Math.min(500, Math.max(1, take)),
      relations: ['doctor'],
    });
    return rows.map((r) => this.mapTimelineRow(r));
  }

  private mapTimelineRow(r: EmrRecord, role?: string) {
    const base = {
      kind: 'emr' as const,
      id: r.id,
      at: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
      doctorName: r.doctor?.name,
      prescriptionCount: Array.isArray(r.prescriptions) ? r.prescriptions.length : 0,
    };
    if (role === Role.BILLING) {
      const dx = (r.diagnosis ?? '').trim();
      return {
        ...base,
        diagnosis: dx ? dx.slice(0, 280) : null,
        billingSummary: 'Clinical detail restricted for billing role',
      };
    }
    return {
      ...base,
      chiefComplaint: r.chiefComplaint,
      diagnosis: r.diagnosis,
      notes: r.notes,
      treatmentPlan: r.treatmentPlan,
    };
  }

  async getEmrTimelineForUser(
    patientId: string,
    currentUser: { role?: string; id?: string; email?: string },
    take = 50,
  ) {
    if (currentUser?.role === 'patient') {
      const owned = await this.patientsService.findOwnedProfileByUser(currentUser);
      if (owned.id !== patientId) {
        throw new ForbiddenException('You can only access your own EMR records');
      }
    }
    const cap = Math.min(500, Math.max(1, take));
    const rows = await this.repo.find({
      where: { patient: { id: patientId } },
      order: { createdAt: 'DESC' },
      take: cap,
      relations: ['doctor'],
    });
    const emrItems = rows.map((r) => this.mapTimelineRow(r, currentUser?.role));
    const nursingItems = await this.nursingService.buildNursingTimeline(patientId, cap);
    return this.mergeClinicalTimeline(emrItems, nursingItems, cap);
  }

  private mergeClinicalTimeline(
    emrItems: Array<Record<string, unknown> & { at: string }>,
    nursingItems: ClinicalTimelineItem[],
    take: number,
  ) {
    const nursingMapped = nursingItems.map((n) => ({
      kind: n.kind,
      id: n.id,
      at: n.at,
      title: n.title,
      summary: n.summary,
      meta: n.meta,
      nursing: true,
    }));
    return [...emrItems, ...nursingMapped]
      .sort((a, b) => String(b.at).localeCompare(String(a.at)))
      .slice(0, take);
  }

  async findByPatient(patientId: string, page = 1, limit = 20) {
    const [data, total] = await this.repo.findAndCount({
      where: { patient: { id: patientId } },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, pages: Math.ceil(total / limit) };
  }

  async findByPatientForUser(
    patientId: string,
    currentUser: { role?: string; id?: string; email?: string },
    page = 1,
    limit = 20,
  ) {
    if (currentUser?.role === 'patient') {
      const owned = await this.patientsService.findOwnedProfileByUser(currentUser);
      if (owned.id !== patientId) {
        throw new ForbiddenException('You can only access your own EMR records');
      }
    }
    return this.findByPatient(patientId, page, limit);
  }

  async findById(id: string): Promise<EmrRecord> {
    const record = await this.repo.findOne({ where: { id } });
    if (!record) throw new NotFoundException(`EMR record ${id} not found`);
    return record;
  }

  async findByIdForUser(id: string, currentUser: { role?: string; id?: string; email?: string }) {
    const record = await this.findById(id);
    if (currentUser?.role === 'patient') {
      const owned = await this.patientsService.findOwnedProfileByUser(currentUser);
      if (record.patient?.id !== owned.id) {
        throw new ForbiddenException('You can only access your own EMR records');
      }
    }
    if (currentUser?.role === Role.BILLING) {
      return {
        id: record.id,
        createdAt: record.createdAt,
        doctor: record.doctor ? { id: record.doctor.id, name: record.doctor.name } : null,
        diagnosis: record.diagnosis,
        prescriptionCount: Array.isArray(record.prescriptions) ? record.prescriptions.length : 0,
        billingSummary: 'Full clinical note restricted for billing role',
      };
    }
    return record;
  }

  async update(
    id: string,
    dto: Partial<CreateEmrDto>,
    currentUser?: { id?: string; role?: string },
  ): Promise<EmrRecord> {
    const current = await this.findById(id);
    if (currentUser?.role === Role.DOCTOR && current.doctor?.id !== currentUser.id) {
      throw new ForbiddenException('You can only update your own EMR records');
    }
    const { icdCodes, patientId: _p, doctorId: _d, appointmentId: _a, ...rest } = dto;
    const payload: Record<string, unknown> = { ...rest };
    if (icdCodes !== undefined) {
      const base = String(payload.diagnosis ?? current.diagnosis ?? '').replace(/^\[ICD [^\]]+\]\s*/, '').trim();
      if (icdCodes.length) {
        const prefix = `[ICD ${icdCodes.join('; ')}]`;
        payload.diagnosis = base ? `${prefix} ${base}` : prefix;
      } else {
        payload.diagnosis = base || null;
      }
    }
    if (Object.keys(payload).length) {
      await this.repo.update(id, payload as any);
    }
    const updated = await this.findById(id);
    if (dto.prescriptions !== undefined) {
      if (dto.prescriptions.length) {
        await this.pharmacyService.queueFromEmrPrescriptions({
          sourceEmrRecordId: updated.id,
          patientId: updated.patient.id,
          doctorId: updated.doctor.id,
          prescriptions: dto.prescriptions,
          replacePending: true,
        });
      } else {
        await this.pharmacyService.clearPendingForEmr(updated.id);
      }
    }
    return updated;
  }

  async getLatestByPatient(patientId: string): Promise<EmrRecord | null> {
    return this.repo.findOne({
      where: { patient: { id: patientId } },
      order: { createdAt: 'DESC' },
    });
  }

  async getLatestByPatientForUser(
    patientId: string,
    currentUser: { role?: string; id?: string; email?: string },
  ) {
    if (currentUser?.role === 'patient') {
      const owned = await this.patientsService.findOwnedProfileByUser(currentUser);
      if (owned.id !== patientId) {
        throw new ForbiddenException('You can only access your own EMR records');
      }
    }
    return this.getLatestByPatient(patientId);
  }
}
