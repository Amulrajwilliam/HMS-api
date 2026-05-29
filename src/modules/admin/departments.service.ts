import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Department } from './entities/department.entity';
import { DoctorProfile } from '../staff/entities/doctor-profile.entity';
import { BillableService } from './entities/billable-service.entity';

@Injectable()
export class DepartmentsService {
  constructor(
    @InjectRepository(Department) private readonly deptRepo: Repository<Department>,
    @InjectRepository(DoctorProfile) private readonly doctorProfileRepo: Repository<DoctorProfile>,
    @InjectRepository(BillableService) private readonly svcRepo: Repository<BillableService>,
  ) {}

  findAll(includeInactive = false) {
    return this.deptRepo.find({
      where: includeInactive ? {} : { isActive: true },
      order: { name: 'ASC' },
    });
  }

  async create(data: { name: string; code: string; description?: string }) {
    const code = data.code.trim().toUpperCase();
    const exists = await this.deptRepo.exists({ where: { code } });
    if (exists) throw new ConflictException('Department code already exists');
    return this.deptRepo.save(
      this.deptRepo.create({
        name: data.name.trim(),
        code,
        description: data.description?.trim() || null,
      }),
    );
  }

  async update(
    id: string,
    patch: Partial<{ name: string; code: string; description: string | null; isActive: boolean }>,
  ) {
    const row = await this.deptRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Department not found');
    if (patch.code !== undefined) {
      const code = patch.code.trim().toUpperCase();
      const other = await this.deptRepo.findOne({ where: { code } });
      if (other && other.id !== id) throw new ConflictException('Department code already in use');
      row.code = code;
    }
    if (patch.name !== undefined) row.name = patch.name.trim();
    if (patch.description !== undefined) row.description = patch.description?.trim() || null;
    if (patch.isActive !== undefined) row.isActive = patch.isActive;
    return this.deptRepo.save(row);
  }

  async remove(id: string) {
    const [docCount, svcCount] = await Promise.all([
      this.doctorProfileRepo.count({ where: { departmentId: id } }),
      this.svcRepo.count({ where: { departmentId: id } }),
    ]);
    if (docCount > 0 || svcCount > 0) {
      throw new BadRequestException(
        'Department is linked to doctor profiles or billable services; deactivate instead or reassign links.',
      );
    }
    await this.deptRepo.delete(id);
    return { deleted: true };
  }
}
