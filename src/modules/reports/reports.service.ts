import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { MedicalReport, ReportStorageProvider } from './entities/medical-report.entity';
import { ReportStorageService } from './report-storage.service';
import { CreateReportUploadFieldsDto } from './dto/reports.dto';
import { PatientsService } from '../patients/patients.service';
import { Role } from '../../common/enums/roles.enum';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(MedicalReport) private readonly repo: Repository<MedicalReport>,
    private readonly storage: ReportStorageService,
    private readonly patientsService: PatientsService,
  ) {}

  async createFromUpload(
    file: Express.Multer.File | undefined,
    dto: CreateReportUploadFieldsDto,
    userId: string,
    requester?: { id: string; role?: string; email?: string },
  ): Promise<MedicalReport & { portalLoginEmail?: string | null }> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('File is required');
    }

    let patientId = dto.patientId?.trim() || undefined;
    const role = requester?.role;

    if (role === Role.PATIENT) {
      const owned = await this.patientsService.findOwnedProfileByUser(requester!);
      if (patientId && patientId !== owned.id) {
        throw new ForbiddenException('You can only upload reports for your own patient profile');
      }
      patientId = owned.id;
    } else if (role === Role.ADMIN || role === Role.DOCTOR || role === Role.LAB) {
      if (!patientId) {
        throw new BadRequestException(
          'patientId is required so the report appears in the patient portal',
        );
      }
      await this.patientsService.findById(patientId);
    } else {
      throw new ForbiddenException('Your role cannot upload reports');
    }

    if (!patientId) {
      throw new BadRequestException('Report must be linked to a patient record');
    }

    const id = randomUUID();
    const stored = await this.storage.persistUpload({
      reportId: id,
      buffer: file.buffer,
      originalFilename: file.originalname,
      mimeType: file.mimetype || 'application/octet-stream',
    });

    const row = this.repo.create({
      id,
      title: dto.title,
      reportType: dto.reportType,
      storageProvider: stored.provider,
      storageKey: stored.storageKey,
      s3Bucket: stored.s3Bucket,
      originalFilename: file.originalname,
      mimeType: file.mimetype || 'application/octet-stream',
      fileSize: stored.fileSize,
      patientId,
      patient: { id: patientId },
      uploadedBy: { id: userId } as any,
    });

    const saved = await this.repo.save(row);
    await this.patientsService.linkPortalUserForPatient(patientId);

    const withPatient = await this.repo.findOne({
      where: { id: saved.id },
      relations: ['patient', 'uploadedBy'],
    });
    const portalLoginEmail = withPatient?.patient
      ? await this.patientsService.findPortalLoginEmailForPatient(withPatient.patient)
      : null;

    return { ...(withPatient ?? saved), portalLoginEmail };
  }

  async findAllForPatientUser(user: { id: string; email?: string }, page = 1, limit = 50) {
    let patientIds = await this.patientsService.findPortalPatientIds(user);
    if (patientIds.length === 0) {
      const owned = await this.patientsService.findOwnedProfileByUser(user);
      patientIds = [owned.id];
    }
    return this.findAllForPatientIds(page, limit, patientIds);
  }

  private async assertPatientOwnsReport(reportId: string, user: { id: string; email?: string }) {
    const r = await this.repo.findOne({ where: { id: reportId }, relations: ['patient'] });
    if (!r) throw new NotFoundException(`Report ${reportId} not found`);

    let portalIds = await this.patientsService.findPortalPatientIds(user);
    if (portalIds.length === 0) {
      const owned = await this.patientsService.findOwnedProfileByUser(user);
      portalIds = [owned.id];
    }

    if (!r.patient?.id || !portalIds.includes(r.patient.id)) {
      throw new ForbiddenException('You can only access your own reports');
    }
  }

  async findByIdForRequester(id: string, requester?: { id: string; role?: string; email?: string }) {
    if (requester?.role === Role.PATIENT) {
      await this.assertPatientOwnsReport(id, requester);
    }
    return this.findById(id);
  }

  async getPresignedUrlForRequester(
    id: string,
    requester?: { id: string; role?: string; email?: string },
  ): Promise<{ url: string | null; expiresIn?: number }> {
    if (requester?.role === Role.PATIENT) {
      await this.assertPatientOwnsReport(id, requester);
    }
    return this.getPresignedUrl(id);
  }

  async findAll(page = 1, limit = 20, patientId?: string) {
    const where = patientId ? { patientId } : {};
    const [data, total] = await this.repo.findAndCount({
      where,
      relations: ['patient', 'uploadedBy'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, pages: Math.ceil(total / limit) };
  }

  async findAllForPatientIds(page: number, limit: number, patientIds: string[]) {
    const [data, total] = await this.repo.findAndCount({
      where: { patientId: In(patientIds) },
      relations: ['patient', 'uploadedBy'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, pages: Math.ceil(total / limit) };
  }

  async findById(id: string): Promise<MedicalReport> {
    const r = await this.repo.findOne({ where: { id }, relations: ['patient'] });
    if (!r) throw new NotFoundException(`Report ${id} not found`);
    return r;
  }

  async getPresignedUrl(id: string): Promise<{ url: string | null; expiresIn?: number }> {
    const r = await this.findById(id);
    if (r.storageProvider !== ReportStorageProvider.S3 || !r.s3Bucket) {
      return { url: null };
    }
    const expiresIn = 300;
    const url = await this.storage.presignedGetUrl(r.storageKey, r.s3Bucket, expiresIn);
    return { url, expiresIn };
  }

  async remove(id: string): Promise<void> {
    const r = await this.findById(id);
    await this.storage.deleteObject(r.storageProvider, r.storageKey, r.s3Bucket ?? undefined);
    await this.repo.softRemove(r);
  }
}
