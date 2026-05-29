import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Patient } from './entities/patient.entity';
import { PatientProblem, ProblemStatus } from './entities/patient-problem.entity';
import { PatientAllergy, AllergyStatus } from './entities/patient-allergy.entity';
import {
  CreatePatientAllergyDto,
  CreatePatientProblemDto,
  ReconcileAllergiesDto,
  UpdatePatientAllergyDto,
  UpdatePatientProblemDto,
} from './dto/patient-clinical.dto';

@Injectable()
export class PatientClinicalService {
  constructor(
    @InjectRepository(Patient) private patientRepo: Repository<Patient>,
    @InjectRepository(PatientProblem) private problemRepo: Repository<PatientProblem>,
    @InjectRepository(PatientAllergy) private allergyRepo: Repository<PatientAllergy>,
  ) {}

  private async assertPatient(id: string) {
    const p = await this.patientRepo.findOne({ where: { id } });
    if (!p) throw new NotFoundException(`Patient ${id} not found`);
    return p;
  }

  private syncLegacyAllergiesField(patientId: string) {
    return this.allergyRepo.find({ where: { patientId, status: AllergyStatus.ACTIVE } }).then((rows) => {
      const summary = rows.map((r) => r.substance).filter(Boolean).join(', ');
      return this.patientRepo.update(patientId, { allergies: summary || undefined });
    });
  }

  async listProblems(patientId: string) {
    await this.assertPatient(patientId);
    return this.problemRepo.find({
      where: { patientId },
      order: { status: 'ASC', updatedAt: 'DESC' },
    });
  }

  async createProblem(patientId: string, dto: CreatePatientProblemDto, userId?: string) {
    await this.assertPatient(patientId);
    const row = this.problemRepo.create({
      patientId,
      icdCode: dto.icdCode?.trim() || null,
      description: dto.description.trim(),
      onsetDate: dto.onsetDate || null,
      createdByUserId: userId ?? null,
      status: ProblemStatus.ACTIVE,
    });
    return this.problemRepo.save(row);
  }

  async updateProblem(patientId: string, problemId: string, dto: UpdatePatientProblemDto) {
    const row = await this.problemRepo.findOne({ where: { id: problemId, patientId } });
    if (!row) throw new NotFoundException('Problem not found');
    if (dto.icdCode !== undefined) row.icdCode = dto.icdCode?.trim() || null;
    if (dto.description !== undefined) row.description = dto.description.trim();
    if (dto.onsetDate !== undefined) row.onsetDate = dto.onsetDate || null;
    if (dto.status !== undefined) {
      row.status = dto.status;
      row.resolvedAt = dto.status === ProblemStatus.RESOLVED ? new Date() : null;
    }
    return this.problemRepo.save(row);
  }

  async listAllergies(patientId: string) {
    await this.assertPatient(patientId);
    return this.allergyRepo.find({
      where: { patientId },
      order: { status: 'ASC', updatedAt: 'DESC' },
    });
  }

  async createAllergy(patientId: string, dto: CreatePatientAllergyDto, userId?: string) {
    await this.assertPatient(patientId);
    const row = this.allergyRepo.create({
      patientId,
      substance: dto.substance.trim(),
      reaction: dto.reaction?.trim() || null,
      severity: dto.severity?.trim() || null,
      status: dto.status ?? AllergyStatus.ACTIVE,
      source: dto.source,
      recordedByUserId: userId ?? null,
    });
    const saved = await this.allergyRepo.save(row);
    await this.syncLegacyAllergiesField(patientId);
    return saved;
  }

  async updateAllergy(patientId: string, allergyId: string, dto: UpdatePatientAllergyDto) {
    const row = await this.allergyRepo.findOne({ where: { id: allergyId, patientId } });
    if (!row) throw new NotFoundException('Allergy not found');
    if (dto.substance !== undefined) row.substance = dto.substance.trim();
    if (dto.reaction !== undefined) row.reaction = dto.reaction?.trim() || null;
    if (dto.severity !== undefined) row.severity = dto.severity?.trim() || null;
    if (dto.status !== undefined) row.status = dto.status;
    const saved = await this.allergyRepo.save(row);
    await this.syncLegacyAllergiesField(patientId);
    return saved;
  }

  async reconcileAllergies(
    patientId: string,
    userId: string,
    dto: ReconcileAllergiesDto,
  ) {
    await this.assertPatient(patientId);
    const rows = dto.allergyIds?.length
      ? await this.allergyRepo.find({
          where: { patientId, id: In(dto.allergyIds) },
        })
      : await this.allergyRepo.find({
          where: { patientId, status: In([AllergyStatus.ACTIVE, AllergyStatus.UNCONFIRMED]) },
        });

    const now = new Date();
    for (const row of rows) {
      if (row.status === AllergyStatus.REFUTED) continue;
      row.reconciledAt = now;
      row.reconciledByUserId = userId;
      if (row.status === AllergyStatus.UNCONFIRMED) row.status = AllergyStatus.ACTIVE;
      await this.allergyRepo.save(row);
    }
    await this.syncLegacyAllergiesField(patientId);
    return { reconciled: rows.length, reconciledAt: now.toISOString() };
  }
}
