import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

@Injectable()
export class NursingService {
  constructor(
    @InjectRepository(NursingFlowsheetEntry) private flowsheetRepo: Repository<NursingFlowsheetEntry>,
    @InjectRepository(NursingCarePlan) private carePlanRepo: Repository<NursingCarePlan>,
    @InjectRepository(NursingEwsScore) private ewsRepo: Repository<NursingEwsScore>,
    @InjectRepository(EmarAdministration) private emarRepo: Repository<EmarAdministration>,
    private patientsService: PatientsService,
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

  async recordEws(patientId: string, userId: string, dto: RecordEwsDto) {
    await this.assertPatient(patientId);
    const totalScore = calculateNews2Score(dto);
    const row = this.ewsRepo.create({
      patientId,
      recordedByUserId: userId,
      totalScore,
      respiratoryRate: dto.respiratoryRate,
      spo2: dto.spo2,
      supplementalO2: dto.supplementalO2,
      temperature: dto.temperature,
      systolicBp: dto.systolicBp,
      pulse: dto.pulse,
      consciousness: dto.consciousness,
    });
    const saved = await this.ewsRepo.save(row);
    return { ...saved, riskBand: ewsRiskBand(totalScore) };
  }

  async listEmar(patientId: string) {
    await this.assertPatient(patientId);
    return this.emarRepo.find({
      where: { patientId },
      order: { scheduledAt: 'ASC', createdAt: 'DESC' },
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
}
