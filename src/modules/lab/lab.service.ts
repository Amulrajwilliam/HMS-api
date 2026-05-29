import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { LabOrder, LabOrderStatus } from './entities/lab-order.entity';
import { LabTest } from './entities/lab-test.entity';
import {
  CreateLabOrderDto,
  CreateLabTestDto,
  RecordSampleDto,
  UpdateLabTestDto,
  UploadLabResultsDto,
} from './dto/lab.dto';

@Injectable()
export class LabService {
  constructor(
    @InjectRepository(LabOrder) private repo: Repository<LabOrder>,
    @InjectRepository(LabTest) private labTestRepo: Repository<LabTest>,
  ) {}

  private async nextOrderNumber(): Promise<string> {
    const count = await this.repo.count();
    return `LAB-${String(count + 1).padStart(5, '0')}`;
  }

  async create(data: CreateLabOrderDto): Promise<LabOrder> {
    const testsFromPayload = data.tests ?? [];
    let fromCatalog: { testName: string; testCode: string; price: number }[] = [];
    if (data.testCatalogIds?.length) {
      const rows = await this.labTestRepo.find({
        where: { id: In(data.testCatalogIds), isActive: true },
      });
      fromCatalog = rows.map((t) => ({
        testName: t.name,
        testCode: t.code,
        price: Number(t.price),
      }));
    }
    const merged = [...testsFromPayload, ...fromCatalog];
    const seen = new Set<string>();
    const tests = merged.filter((t) => {
      const k = t.testCode.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    if (tests.length === 0) {
      throw new BadRequestException('Select at least one test or catalog item');
    }

    const order = this.repo.create({
      orderNumber: await this.nextOrderNumber(),
      patient: { id: data.patientId } as any,
      doctor: data.doctorId ? ({ id: data.doctorId } as any) : undefined,
      tests,
      priority: data.priority as any,
      sampleType: data.sampleType,
      notes: data.notes,
    });
    return this.repo.save(order);
  }

  async findAll(page = 1, limit = 20, status?: string, patientId?: string) {
    const qb = this.repo
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.patient', 'patient')
      .leftJoinAndSelect('order.doctor', 'doctor')
      .orderBy('order.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);
    if (status) qb.andWhere('order.status = :status', { status });
    if (patientId) qb.andWhere('patient.id = :patientId', { patientId });
    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, pages: Math.ceil(total / limit) };
  }

  async findById(id: string): Promise<LabOrder> {
    const o = await this.repo.findOne({ where: { id } });
    if (!o) throw new NotFoundException(`Lab order ${id} not found`);
    return o;
  }

  async updateStatus(id: string, status: LabOrderStatus): Promise<LabOrder> {
    await this.findById(id);
    const update: any = { status };
    if (status === LabOrderStatus.SAMPLE_COLLECTED) update.sampleCollectedAt = new Date();
    if (status === LabOrderStatus.COMPLETED) update.reportReadyAt = new Date();
    await this.repo.update(id, update);
    return this.findById(id);
  }

  async recordSample(id: string, dto: RecordSampleDto): Promise<LabOrder> {
    await this.findById(id);
    await this.repo.update(id, {
      status: LabOrderStatus.SAMPLE_COLLECTED,
      sampleCollectedAt: new Date(),
      sampleBarcode: dto.sampleBarcode ?? undefined,
    });
    return this.findById(id);
  }

  async uploadResults(id: string, body: UploadLabResultsDto): Promise<LabOrder> {
    await this.findById(id);
    await this.repo.update(id, {
      results: body.results,
      status: LabOrderStatus.COMPLETED,
      reportReadyAt: new Date(),
    });
    return this.findById(id);
  }

  async getPendingCount() {
    return this.repo.count({ where: { status: LabOrderStatus.PENDING } });
  }

  // --- catalog ---
  async listTests(activeOnly = true) {
    const where = activeOnly ? { isActive: true } : {};
    return this.labTestRepo.find({ where, order: { code: 'ASC' } });
  }

  async createTest(dto: CreateLabTestDto): Promise<LabTest> {
    const row = this.labTestRepo.create({
      code: dto.code.trim().toUpperCase(),
      name: dto.name,
      price: dto.price,
      sampleTypeHint: dto.sampleTypeHint,
      department: dto.department,
    });
    return this.labTestRepo.save(row);
  }

  async updateTest(id: string, dto: UpdateLabTestDto): Promise<LabTest> {
    const t = await this.labTestRepo.findOne({ where: { id } });
    if (!t) throw new NotFoundException(`Lab test ${id} not found`);
    Object.assign(t, dto);
    if (dto.price !== undefined) t.price = dto.price as any;
    return this.labTestRepo.save(t);
  }

  async deactivateTest(id: string): Promise<LabTest> {
    return this.updateTest(id, { isActive: false });
  }
}
