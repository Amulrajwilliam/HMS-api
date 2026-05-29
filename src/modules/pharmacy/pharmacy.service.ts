import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Medicine } from './entities/medicine.entity';
import {
  PrescriptionFulfillment,
  FulfillmentStatus,
} from './entities/prescription-fulfillment.entity';
import { CreateFulfillmentDto, FulfillmentStatusDto } from './dto/pharmacy.dto';
import { PrescriptionDto } from '../emr/dto/create-emr.dto';
import { PatientsService } from '../patients/patients.service';

@Injectable()
export class PharmacyService {
  constructor(
    @InjectRepository(Medicine) private repo: Repository<Medicine>,
    @InjectRepository(PrescriptionFulfillment)
    private fulfillmentRepo: Repository<PrescriptionFulfillment>,
    private readonly patientsService: PatientsService,
  ) {}

  async findAll(search?: string, category?: string, lowStock?: boolean) {
    const qb = this.repo.createQueryBuilder('m').where('m.isActive = true');
    if (search) qb.andWhere('(m.name ILIKE :s OR m.genericName ILIKE :s)', { s: `%${search}%` });
    if (category) qb.andWhere('m.category = :category', { category });
    if (lowStock) qb.andWhere('m.stock <= m.reorderLevel');
    return qb.orderBy('m.name').getMany();
  }

  async findById(id: string): Promise<Medicine> {
    const m = await this.repo.findOne({ where: { id, isActive: true } });
    if (!m) throw new NotFoundException(`Medicine ${id} not found`);
    return m;
  }

  async create(data: Partial<Medicine>): Promise<Medicine> {
    return this.repo.save(this.repo.create(data));
  }

  async update(id: string, data: Partial<Medicine>): Promise<Medicine> {
    await this.findById(id);
    await this.repo.update(id, data);
    return this.findById(id);
  }

  async adjustStock(id: string, quantity: number, type: 'add' | 'remove'): Promise<Medicine> {
    const med = await this.findById(id);
    const newStock = type === 'add' ? med.stock + quantity : med.stock - quantity;
    if (newStock < 0) throw new BadRequestException(`Insufficient stock. Current: ${med.stock}`);
    await this.repo.update(id, { stock: newStock });
    return this.findById(id);
  }

  async getLowStockAlerts() { return this.repo.createQueryBuilder('m').where('m.stock <= m.reorderLevel AND m.isActive = true').getMany(); }

  async getStats() {
    const total = await this.repo.count({ where: { isActive: true } });
    const lowStock = await this.repo.createQueryBuilder('m').where('m.stock <= m.reorderLevel AND m.isActive = :a', { a: true }).getCount();
    const outOfStock = await this.repo.count({ where: { stock: 0, isActive: true } });
    const pendingFulfillment = await this.fulfillmentRepo.count({
      where: { status: FulfillmentStatus.PENDING },
    });
    return { total, lowStock, outOfStock, pendingFulfillment };
  }

  async createFulfillment(data: CreateFulfillmentDto): Promise<PrescriptionFulfillment> {
    if (!data.medicineId && !data.medicineName?.trim()) {
      throw new BadRequestException('Either medicineId or medicineName is required');
    }

    const row = this.fulfillmentRepo.create({
      patient: { id: data.patientId } as any,
      prescribedBy: data.prescribedById ? ({ id: data.prescribedById } as any) : undefined,
      medicine: data.medicineId ? ({ id: data.medicineId } as any) : undefined,
      medicineName: data.medicineName?.trim() || undefined,
      sourceEmrRecordId: data.sourceEmrRecordId,
      quantity: data.quantity,
      dose: data.dose,
      instructions: data.instructions,
      notes: data.notes,
      status: FulfillmentStatus.PENDING,
    });
    return this.fulfillmentRepo.save(row);
  }

  async listFulfillment(status?: string) {
    const qb = this.fulfillmentRepo.createQueryBuilder('f').orderBy('f.createdAt', 'DESC');
    if (status) qb.andWhere('f.status = :status', { status });
    return qb.getMany();
  }

  async listFulfillmentForPatient(patientId: string, status?: string) {
    const qb = this.fulfillmentRepo
      .createQueryBuilder('f')
      .leftJoinAndSelect('f.patient', 'patient')
      .leftJoinAndSelect('f.prescribedBy', 'prescribedBy')
      .where('patient.id = :patientId', { patientId })
      .orderBy('f.createdAt', 'DESC');
    if (status) qb.andWhere('f.status = :status', { status });
    return qb.getMany();
  }

  async listFulfillmentForPatientUser(user: { id: string; email?: string }) {
    const patient = await this.patientsService.findOwnedProfileByUser(user);
    return this.fulfillmentRepo
      .createQueryBuilder('f')
      .where('f.patientId = :pid', { pid: patient.id })
      .orderBy('f.createdAt', 'DESC')
      .getMany();
  }

  async updateFulfillmentStatus(
    id: string,
    dto: FulfillmentStatusDto,
    userId?: string,
  ): Promise<PrescriptionFulfillment> {
    const row = await this.fulfillmentRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException(`Fulfillment ${id} not found`);

    row.status = dto.status;
    row.notes = dto.notes ?? row.notes;

    if (dto.status === FulfillmentStatus.DISPENSED) {
      row.fulfilledAt = new Date();
      row.fulfilledBy = userId ? ({ id: userId } as any) : row.fulfilledBy;
      if (row.medicine?.id) {
        const med = await this.findById(row.medicine.id);
        if (med.stock < row.quantity) {
          throw new BadRequestException(`Insufficient stock. Current: ${med.stock}`);
        }
        await this.repo.update(med.id, { stock: med.stock - row.quantity });
      }
    }

    return this.fulfillmentRepo.save(row);
  }

  async queueFromEmrPrescriptions(params: {
    sourceEmrRecordId: string;
    patientId: string;
    doctorId: string;
    prescriptions: PrescriptionDto[];
    /** When true, remove pending fulfillments for this EMR and re-queue (used on EMR update). */
    replacePending?: boolean;
  }): Promise<{ created: number; skipped: boolean; replaced: number }> {
    if (!params.prescriptions?.length) return { created: 0, skipped: false, replaced: 0 };

    let replaced = 0;
    if (params.replacePending) {
      const pending = await this.fulfillmentRepo.find({
        where: { sourceEmrRecordId: params.sourceEmrRecordId, status: FulfillmentStatus.PENDING },
      });
      if (pending.length) {
        await this.fulfillmentRepo.remove(pending);
        replaced = pending.length;
      }
    } else {
      const existing = await this.fulfillmentRepo.count({
        where: { sourceEmrRecordId: params.sourceEmrRecordId },
      });
      if (existing > 0) return { created: 0, skipped: true, replaced: 0 };
    }

    let created = 0;
    for (const p of params.prescriptions) {
      const qtyGuess = Number((p.duration || '').match(/\d+/)?.[0] || 1);
      const med = await this.repo.findOne({ where: { name: p.drug, isActive: true } });
      const row = this.fulfillmentRepo.create({
        patient: { id: params.patientId } as any,
        prescribedBy: { id: params.doctorId } as any,
        medicine: med ? ({ id: med.id } as any) : undefined,
        medicineName: p.drug,
        quantity: Number.isFinite(qtyGuess) && qtyGuess > 0 ? qtyGuess : 1,
        dose: p.dosage,
        instructions: p.instructions || `${p.frequency} for ${p.duration}`,
        sourceEmrRecordId: params.sourceEmrRecordId,
        status: FulfillmentStatus.PENDING,
      });
      await this.fulfillmentRepo.save(row);
      created += 1;
    }

    return { created, skipped: false, replaced };
  }

  /** Remove pending pharmacy queue rows for an EMR record (e.g. prescriptions cleared on update). */
  async clearPendingForEmr(sourceEmrRecordId: string): Promise<number> {
    const pending = await this.fulfillmentRepo.find({
      where: { sourceEmrRecordId, status: FulfillmentStatus.PENDING },
    });
    if (pending.length) await this.fulfillmentRepo.remove(pending);
    return pending.length;
  }
}
