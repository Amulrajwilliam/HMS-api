import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  EmarAdministration,
  EmarStatus,
  NursingCarePlan,
  NursingEwsScore,
  NursingFlowsheetEntry,
} from './entities/nursing-chart.entity';
import {
  CreateCarePlanDto,
  CreateEmarDto,
  CreateFlowsheetDto,
  RecordEwsDto,
  UpdateCarePlanDto,
  UpdateEmarDto,
} from './dto/nursing.dto';
import { calculateNews2Score, ewsRiskBand } from './nursing-ews.util';
import { PatientsService } from '../patients/patients.service';
import { PharmacyService } from '../pharmacy/pharmacy.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { AdtService } from '../adt/adt.service';
import { ClinicalTimelineItem } from './nursing-timeline.types';
import { FulfillmentStatus } from '../pharmacy/entities/prescription-fulfillment.entity';

@Injectable()
export class NursingService {
  constructor(
    @InjectRepository(NursingFlowsheetEntry) private flowsheetRepo: Repository<NursingFlowsheetEntry>,
    @InjectRepository(NursingCarePlan) private carePlanRepo: Repository<NursingCarePlan>,
    @InjectRepository(NursingEwsScore) private ewsRepo: Repository<NursingEwsScore>,
    @InjectRepository(EmarAdministration) private emarRepo: Repository<EmarAdministration>,
    private patientsService: PatientsService,
    private pharmacyService: PharmacyService,
    private notificationsService: NotificationsService,
    private adtService: AdtService,
  ) {}

  private async assertPatient(patientId: string) {
    await this.patientsService.findById(patientId);
  }

  async listFlowsheet(patientId: string, limit = 30) {
    await this.assertPatient(patientId);
    return this.flowsheetRepo.find({
      where: { patientId },
      order: { createdAt: 'DESC' },
      take: Math.min(100, limit),
    });
  }

  async addFlowsheet(patientId: string, userId: string, dto: CreateFlowsheetDto) {
    await this.assertPatient(patientId);
    const row = this.flowsheetRepo.create({
      patientId,
      recordedByUserId: userId,
      ...dto,
    });
    return this.flowsheetRepo.save(row);
  }

  async listCarePlans(patientId: string) {
    await this.assertPatient(patientId);
    return this.carePlanRepo.find({
      where: { patientId },
      order: { updatedAt: 'DESC' },
    });
  }

  async addCarePlan(patientId: string, userId: string, dto: CreateCarePlanDto) {
    await this.assertPatient(patientId);
    const row = this.carePlanRepo.create({
      patientId,
      createdByUserId: userId,
      ...dto,
    });
    return this.carePlanRepo.save(row);
  }

  async updateCarePlan(patientId: string, planId: string, dto: UpdateCarePlanDto) {
    const row = await this.carePlanRepo.findOne({ where: { id: planId, patientId } });
    if (!row) throw new NotFoundException('Care plan not found');
    Object.assign(row, dto);
    return this.carePlanRepo.save(row);
  }

  async listEws(patientId: string, limit = 20) {
    await this.assertPatient(patientId);
    return this.ewsRepo.find({
      where: { patientId },
      order: { createdAt: 'DESC' },
      take: Math.min(50, limit),
    });
  }

  async listEwsAlerts(limit = 30) {
    return this.ewsRepo.find({
      where: { riskBand: In(['medium', 'high']) },
      order: { createdAt: 'DESC' },
      take: Math.min(100, limit),
    });
  }

  async recordEws(patientId: string, userId: string, dto: RecordEwsDto) {
    await this.assertPatient(patientId);
    const totalScore = calculateNews2Score(dto);
    const riskBand = ewsRiskBand(totalScore);
    const row = this.ewsRepo.create({
      patientId,
      recordedByUserId: userId,
      totalScore,
      riskBand,
      respiratoryRate: dto.respiratoryRate,
      spo2: dto.spo2,
      supplementalO2: dto.supplementalO2,
      temperature: dto.temperature,
      systolicBp: dto.systolicBp,
      pulse: dto.pulse,
      consciousness: dto.consciousness,
    });
    const saved = await this.ewsRepo.save(row);

    if (riskBand !== 'low') {
      const patient = await this.patientsService.findById(patientId);
      const type = riskBand === 'high' ? NotificationType.ALERT : NotificationType.WARNING;
      await this.notificationsService.create({
        title: `EWS ${riskBand === 'high' ? 'high' : 'medium'} risk — ${patient.name}`,
        message: `NEWS2-style score ${totalScore} recorded. Review nursing chart and escalate care.`,
        type,
        actionUrl: `/nursing/${patientId}`,
        relatedId: saved.id,
      });
      const admission = await this.adtService.findActiveAdmissionForPatient(patientId);
      const doctorId = admission?.admittingDoctor?.id;
      if (doctorId) {
        await this.notificationsService.create({
          userId: doctorId,
          title: `Patient EWS ${riskBand} — ${patient.name}`,
          message: `Score ${totalScore}. Ward nursing has been alerted.`,
          type,
          actionUrl: `/emr/${patientId}/timeline`,
          relatedId: saved.id,
        });
      }
    }

    return { ...saved, riskBand };
  }

  async listEmar(patientId: string) {
    await this.assertPatient(patientId);
    return this.emarRepo.find({
      where: { patientId },
      order: { scheduledAt: 'ASC', createdAt: 'DESC' },
    });
  }

  async listDueEmar(patientId: string) {
    await this.assertPatient(patientId);
    const rows = await this.emarRepo.find({
      where: { patientId, status: EmarStatus.SCHEDULED },
      order: { scheduledAt: 'ASC' },
    });
    const now = Date.now();
    const twoHours = 2 * 60 * 60 * 1000;
    return rows.filter((r) => {
      if (!r.scheduledAt) return true;
      const t = new Date(r.scheduledAt).getTime();
      return t <= now + twoHours;
    });
  }

  async scheduleEmar(patientId: string, userId: string, dto: CreateEmarDto) {
    await this.assertPatient(patientId);
    const row = this.emarRepo.create({
      patientId,
      medicineName: dto.medicineName,
      dose: dto.dose ?? null,
      route: dto.route ?? null,
      scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : new Date(),
      status: EmarStatus.SCHEDULED,
      notes: dto.notes ?? null,
      administeredByUserId: userId,
    });
    return this.emarRepo.save(row);
  }

  async scheduleEmarFromPrescriptions(
    patientId: string,
    userId: string,
    opts?: { sourceEmrRecordId?: string; includeDispensed?: boolean },
  ) {
    await this.assertPatient(patientId);
    const fulfillments = await this.pharmacyService.listFulfillmentForPatient(patientId);
    const statuses = opts?.includeDispensed
      ? [FulfillmentStatus.PENDING, FulfillmentStatus.DISPENSED]
      : [FulfillmentStatus.PENDING];

    const eligible = fulfillments.filter((f) => statuses.includes(f.status));
    const existing = await this.emarRepo.find({
      where: { patientId },
      select: ['prescriptionFulfillmentId'],
    });
    const linked = new Set(
      existing.map((e) => e.prescriptionFulfillmentId).filter(Boolean) as string[],
    );

    const created: EmarAdministration[] = [];
    for (const f of eligible) {
      if (linked.has(f.id)) continue;
      if (opts?.sourceEmrRecordId && f.sourceEmrRecordId && f.sourceEmrRecordId !== opts.sourceEmrRecordId) {
        continue;
      }
      const name = f.medicineName ?? f.medicine?.name ?? 'Medication';
      const row = this.emarRepo.create({
        patientId,
        medicineName: name,
        dose: f.dose ?? null,
        route: 'oral',
        scheduledAt: new Date(),
        status: EmarStatus.SCHEDULED,
        notes: f.instructions ?? f.notes ?? null,
        prescriptionFulfillmentId: f.id,
        sourceEmrRecordId: f.sourceEmrRecordId ?? opts?.sourceEmrRecordId ?? null,
        administeredByUserId: userId,
      });
      created.push(await this.emarRepo.save(row));
    }
    return { created, skipped: eligible.length - created.length };
  }

  async updateEmar(patientId: string, id: string, userId: string, dto: UpdateEmarDto) {
    const row = await this.emarRepo.findOne({ where: { id, patientId } });
    if (!row) throw new NotFoundException('eMAR entry not found');
    row.status = dto.status;
    if (dto.notes !== undefined) row.notes = dto.notes;
    if (dto.status === EmarStatus.GIVEN) {
      row.administeredAt = new Date();
      row.administeredByUserId = userId;
    }
    return this.emarRepo.save(row);
  }

  async buildNursingTimeline(patientId: string, take = 80): Promise<ClinicalTimelineItem[]> {
    await this.assertPatient(patientId);
    const limit = Math.min(200, Math.max(1, take));
    const [flowsheet, ews, plans, emar] = await Promise.all([
      this.flowsheetRepo.find({ where: { patientId }, order: { createdAt: 'DESC' }, take: limit }),
      this.ewsRepo.find({ where: { patientId }, order: { createdAt: 'DESC' }, take: limit }),
      this.carePlanRepo.find({ where: { patientId }, order: { updatedAt: 'DESC' }, take: limit }),
      this.emarRepo.find({ where: { patientId }, order: { updatedAt: 'DESC' }, take: limit }),
    ]);

    const items: ClinicalTimelineItem[] = [];

    for (const f of flowsheet) {
      const parts = [
        f.bloodPressure && `BP ${f.bloodPressure}`,
        f.temperature != null && `T ${f.temperature}°C`,
        f.pulseRate && `P ${f.pulseRate}`,
        f.oxygenSaturation && `SpO₂ ${f.oxygenSaturation}%`,
      ].filter(Boolean);
      items.push({
        kind: 'nursing_flowsheet',
        id: f.id,
        at: f.createdAt.toISOString(),
        title: 'Nursing flowsheet',
        summary: parts.join(' · ') || f.notes || 'Vitals entry',
        meta: { shiftLabel: f.shiftLabel, painScore: f.painScore },
      });
    }

    for (const e of ews) {
      items.push({
        kind: 'nursing_ews',
        id: e.id,
        at: e.createdAt.toISOString(),
        title: `Early warning score: ${e.totalScore}`,
        summary: `Risk: ${e.riskBand ?? ewsRiskBand(e.totalScore)} · RR ${e.respiratoryRate} · SpO₂ ${e.spo2}%`,
        meta: { totalScore: e.totalScore, riskBand: e.riskBand },
      });
    }

    for (const p of plans) {
      items.push({
        kind: 'nursing_care_plan',
        id: p.id,
        at: (p.updatedAt ?? p.createdAt).toISOString(),
        title: `Care plan: ${p.status}`,
        summary: p.problem,
        meta: { goal: p.goal, intervention: p.intervention },
      });
    }

    for (const m of emar) {
      items.push({
        kind: 'emar',
        id: m.id,
        at: (m.administeredAt ?? m.scheduledAt ?? m.updatedAt).toISOString(),
        title: `eMAR: ${m.medicineName}`,
        summary: `${m.dose ?? ''} ${m.route ?? ''} — ${m.status}`.trim(),
        meta: { status: m.status },
      });
    }

    return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
  }
}
