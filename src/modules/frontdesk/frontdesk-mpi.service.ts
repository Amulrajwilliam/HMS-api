import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Patient } from '../patients/entities/patient.entity';
import { PatientMergeLog } from './entities/patient-merge-log.entity';

export type DuplicateGroup = {
  matchKey: string;
  matchType: 'phone' | 'name_dob' | 'email';
  patients: Array<{
    id: string;
    uhid: string;
    name: string;
    phone: string;
    dob: string;
    email?: string | null;
  }>;
};

@Injectable()
export class FrontdeskMpiService {
  constructor(
    @InjectRepository(Patient) private readonly patientRepo: Repository<Patient>,
    @InjectRepository(PatientMergeLog) private readonly mergeLogRepo: Repository<PatientMergeLog>,
    private readonly dataSource: DataSource,
  ) {}

  async findDuplicateGroups(search?: string, limit = 30): Promise<DuplicateGroup[]> {
    const qb = this.patientRepo
      .createQueryBuilder('p')
      .where('p.deletedAt IS NULL')
      .orderBy('p.createdAt', 'DESC')
      .take(500);

    if (search?.trim()) {
      qb.andWhere('(p.name ILIKE :q OR p.phone ILIKE :q OR p.uhid ILIKE :q)', {
        q: `%${search.trim()}%`,
      });
    }

    const patients = await qb.getMany();
    const byPhone = new Map<string, Patient[]>();
    const byNameDob = new Map<string, Patient[]>();
    const byEmail = new Map<string, Patient[]>();

    for (const p of patients) {
      const phoneKey = p.phone?.replace(/\D/g, '').slice(-10);
      if (phoneKey && phoneKey.length >= 10) {
        const list = byPhone.get(phoneKey) ?? [];
        list.push(p);
        byPhone.set(phoneKey, list);
      }
      const ndKey = `${(p.name ?? '').trim().toLowerCase()}|${p.dob}`;
      if (p.name && p.dob) {
        const list = byNameDob.get(ndKey) ?? [];
        list.push(p);
        byNameDob.set(ndKey, list);
      }
      const email = p.email?.trim().toLowerCase();
      if (email) {
        const list = byEmail.get(email) ?? [];
        list.push(p);
        byEmail.set(email, list);
      }
    }

    const groups: DuplicateGroup[] = [];
    const seen = new Set<string>();

    const pushGroup = (matchType: DuplicateGroup['matchType'], matchKey: string, rows: Patient[]) => {
      if (rows.length < 2) return;
      const sig = rows
        .map((r) => r.id)
        .sort()
        .join(',');
      if (seen.has(sig)) return;
      seen.add(sig);
      groups.push({
        matchType,
        matchKey,
        patients: rows.map((r) => ({
          id: r.id,
          uhid: r.uhid,
          name: r.name,
          phone: r.phone,
          dob: r.dob,
          email: r.email,
        })),
      });
    };

    for (const [k, rows] of byPhone) pushGroup('phone', k, rows);
    for (const [k, rows] of byNameDob) pushGroup('name_dob', k, rows);
    for (const [k, rows] of byEmail) pushGroup('email', k, rows);

    return groups.slice(0, limit);
  }

  async mergePatients(
    survivorPatientId: string,
    duplicatePatientId: string,
    mergedByUserId: string,
  ) {
    if (survivorPatientId === duplicatePatientId) {
      throw new BadRequestException('Survivor and duplicate must be different patients');
    }

    const survivor = await this.patientRepo.findOne({ where: { id: survivorPatientId } });
    const duplicate = await this.patientRepo.findOne({ where: { id: duplicatePatientId } });
    if (!survivor || !duplicate) {
      throw new NotFoundException('Patient not found');
    }

    const snapshot = {
      uhid: duplicate.uhid,
      name: duplicate.name,
      phone: duplicate.phone,
      email: duplicate.email,
      dob: duplicate.dob,
    };

    const patientTables = [
      'appointments',
      'admissions',
      'invoices',
      'emr_records',
      'lab_orders',
      'medical_reports',
      'patient_problems',
      'patient_allergies',
      'prescription_fulfillments',
      'nursing_flowsheet_entries',
      'nursing_care_plans',
      'nursing_ews_scores',
      'emar_administrations',
      'visit_check_ins',
      'appointment_waitlist',
    ];

    await this.dataSource.transaction(async (manager) => {
      for (const table of patientTables) {
        await manager.query(
          `UPDATE "${table}" SET "patientId" = $1 WHERE "patientId" = $2`,
          [survivorPatientId, duplicatePatientId],
        );
      }

      if (!survivor.userId && duplicate.userId) {
        await manager.update(Patient, survivorPatientId, { userId: duplicate.userId });
        await manager.update(Patient, duplicatePatientId, { userId: null as any });
      }

      if (!survivor.email && duplicate.email) {
        await manager.update(Patient, survivorPatientId, { email: duplicate.email });
      }
      if (!survivor.address && duplicate.address) {
        await manager.update(Patient, survivorPatientId, { address: duplicate.address });
      }

      await manager.softDelete(Patient, duplicatePatientId);

      await manager.save(
        manager.create(PatientMergeLog, {
          survivorPatient: { id: survivorPatientId },
          mergedPatientId: duplicatePatientId,
          mergedUhid: duplicate.uhid,
          mergedSnapshot: snapshot,
          mergedBy: { id: mergedByUserId },
        }),
      );
    });

    return this.patientRepo.findOne({ where: { id: survivorPatientId } });
  }

  async listMergeLogs(page = 1, limit = 20) {
    const [data, total] = await this.mergeLogRepo.findAndCount({
      relations: ['survivorPatient', 'mergedBy'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, pages: Math.ceil(total / limit) || 1 };
  }
}
