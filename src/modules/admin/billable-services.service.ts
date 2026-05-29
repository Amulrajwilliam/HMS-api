import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BillableService } from './entities/billable-service.entity';
import { Department } from './entities/department.entity';

@Injectable()
export class BillableServicesService {
  constructor(
    @InjectRepository(BillableService) private readonly repo: Repository<BillableService>,
    @InjectRepository(Department) private readonly deptRepo: Repository<Department>,
  ) {}

  findAll(includeInactive = false) {
    return this.repo.find({
      where: includeInactive ? {} : { isActive: true },
      relations: ['department'],
      order: { code: 'ASC' },
    });
  }

  async create(data: {
    code: string;
    name: string;
    description?: string;
    defaultPrice: number;
    departmentId?: string | null;
  }) {
    const code = data.code.trim().toUpperCase();
    const exists = await this.repo.exists({ where: { code } });
    if (exists) throw new ConflictException('Service code already exists');
    if (data.departmentId) {
      const d = await this.deptRepo.findOne({ where: { id: data.departmentId, isActive: true } });
      if (!d) throw new BadRequestException('Invalid department');
    }
    const row = this.repo.create({
      code,
      name: data.name.trim(),
      description: data.description?.trim() || null,
      defaultPrice: Math.max(0, data.defaultPrice).toFixed(2),
      departmentId: data.departmentId ?? null,
    });
    return this.repo.save(row);
  }

  async update(
    id: string,
    patch: Partial<{
      code: string;
      name: string;
      description: string | null;
      defaultPrice: number;
      departmentId: string | null;
      isActive: boolean;
    }>,
  ) {
    const row = await this.repo.findOne({ where: { id }, relations: ['department'] });
    if (!row) throw new NotFoundException('Service not found');
    if (patch.code !== undefined) {
      const code = patch.code.trim().toUpperCase();
      const other = await this.repo.findOne({ where: { code } });
      if (other && other.id !== id) throw new ConflictException('Service code already in use');
      row.code = code;
    }
    if (patch.name !== undefined) row.name = patch.name.trim();
    if (patch.description !== undefined) row.description = patch.description?.trim() || null;
    if (patch.defaultPrice !== undefined) {
      const n = Number(patch.defaultPrice);
      if (Number.isNaN(n) || n < 0) throw new BadRequestException('defaultPrice must be >= 0');
      row.defaultPrice = n.toFixed(2);
    }
    if (patch.departmentId !== undefined) {
      if (patch.departmentId) {
        const d = await this.deptRepo.findOne({ where: { id: patch.departmentId, isActive: true } });
        if (!d) throw new BadRequestException('Invalid department');
      }
      row.departmentId = patch.departmentId;
    }
    if (patch.isActive !== undefined) row.isActive = patch.isActive;
    return this.repo.save(row);
  }

  async remove(id: string) {
    await this.repo.findOneOrFail({ where: { id } });
    await this.repo.delete(id);
    return { deleted: true };
  }
}
