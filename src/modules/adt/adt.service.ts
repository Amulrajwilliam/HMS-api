import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ward } from './entities/ward.entity';
import { Bed, BedStatus } from './entities/bed.entity';
import { Admission, AdmissionStatus } from './entities/admission.entity';

@Injectable()
export class AdtService {
  constructor(
    @InjectRepository(Ward) private wardRepo: Repository<Ward>,
    @InjectRepository(Bed) private bedRepo: Repository<Bed>,
    @InjectRepository(Admission) private admissionRepo: Repository<Admission>,
  ) {}

  // ── Wards ──
  async getWards() {
    const wards = await this.wardRepo.find({ where: { isActive: true }, relations: ['beds'] });
    return wards.map(w => ({
      ...w,
      totalBeds: w.beds?.length ?? 0,
      available: w.beds?.filter(b => b.status === BedStatus.AVAILABLE).length ?? 0,
      occupied: w.beds?.filter(b => b.status === BedStatus.OCCUPIED).length ?? 0,
    }));
  }

  async createWard(data: Partial<Ward>) { return this.wardRepo.save(this.wardRepo.create(data)); }

  // ── Beds ──
  async getBedsByWard(wardId: string) {
    return this.bedRepo.find({ where: { ward: { id: wardId } }, order: { bedNumber: 'ASC' } });
  }

  async getAvailableBeds() {
    return this.bedRepo.find({
      where: { status: BedStatus.AVAILABLE },
      relations: ['ward'],
      order: { bedNumber: 'ASC' },
    });
  }

  async createBed(data: { wardId: string; bedNumber: string; pricePerDay: number; bedType?: string }) {
    const ward = await this.wardRepo.findOne({ where: { id: data.wardId } });
    if (!ward) throw new NotFoundException('Ward not found');
    const bed = this.bedRepo.create({ bedNumber: data.bedNumber, ward, pricePerDay: data.pricePerDay, bedType: data.bedType });
    return this.bedRepo.save(bed);
  }

  // ── Admissions ──
  async admit(data: { patientId: string; bedId: string; doctorId?: string; diagnosis?: string; notes?: string }) {
    const bed = await this.bedRepo.findOne({ where: { id: data.bedId } });
    if (!bed) throw new NotFoundException('Bed not found');
    if (bed.status !== BedStatus.AVAILABLE) throw new BadRequestException(`Bed ${bed.bedNumber} is not available`);

    const admission = this.admissionRepo.create({
      patient: { id: data.patientId } as any,
      bed,
      admittingDoctor: data.doctorId ? { id: data.doctorId } as any : undefined,
      admittedAt: new Date(),
      admissionDiagnosis: data.diagnosis,
      notes: data.notes,
      status: AdmissionStatus.ADMITTED,
    });
    await this.bedRepo.update(data.bedId, { status: BedStatus.OCCUPIED });
    const saved = await this.admissionRepo.save(admission);
    return this.getAdmissionById(saved.id);
  }

  async discharge(id: string, summary: string) {
    const admission = await this.admissionRepo.findOne({
      where: { id },
      relations: ['bed'],
    });
    if (!admission) throw new NotFoundException('Admission not found');
    if (admission.status === AdmissionStatus.DISCHARGED) throw new BadRequestException('Already discharged');
    if (!admission.bed?.id) throw new BadRequestException('Admission has no linked bed');

    const dischargedAt = new Date();
    const dischargeSummary = summary.trim();

    await this.bedRepo.update(admission.bed.id, { status: BedStatus.AVAILABLE });
    // Use update() — save() with eager relations was clearing patientId / bedId (NOT NULL violation).
    await this.admissionRepo.update(id, {
      status: AdmissionStatus.DISCHARGED,
      dischargedAt,
      dischargeSummary,
    });

    return this.getAdmissionById(id);
  }

  async getAdmissions(page = 1, limit = 20, status?: string) {
    const where: any = {};
    if (status) where.status = status;
    const [data, total] = await this.admissionRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
      // patient, bed, admittingDoctor are eager on Admission — avoid duplicate joins
      relations: ['bed', 'bed.ward'],
    });
    return { data, total, page, pages: Math.ceil(total / limit) };
  }

  /** Latest active inpatient admission for vitals / nurse workflows. */
  async findActiveAdmissionForPatient(patientId: string) {
    return this.admissionRepo.findOne({
      where: { patient: { id: patientId }, status: AdmissionStatus.ADMITTED },
      order: { admittedAt: 'DESC' },
      relations: ['patient', 'bed', 'bed.ward', 'admittingDoctor'],
    });
  }

  async getAdmissionsByPatient(patientId: string) {
    return this.admissionRepo.find({ where: { patient: { id: patientId } }, order: { admittedAt: 'DESC' } });
  }

  async getAdmissionById(id: string) {
    const admission = await this.admissionRepo.findOne({
      where: { id },
      relations: ['bed', 'bed.ward'],
    });
    if (!admission) throw new NotFoundException(`Admission ${id} not found`);
    return admission;
  }

  async getOccupancyStats() {
    const total = await this.bedRepo.count();
    const available = await this.bedRepo.count({ where: { status: BedStatus.AVAILABLE } });
    const occupied = await this.bedRepo.count({ where: { status: BedStatus.OCCUPIED } });
    const maintenance = await this.bedRepo.count({ where: { status: BedStatus.MAINTENANCE } });
    return { total, available, occupied, maintenance, occupancyRate: total ? Math.round((occupied / total) * 100) : 0 };
  }
}
