import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice } from '../billing/entities/invoice.entity';
import { InsuranceClaim, InsuranceClaimStatus } from './entities/insurance-claim.entity';
import {
  AppealInsuranceClaimDto,
  CheckEligibilityDto,
  CreateInsuranceClaimDto,
  UpdateInsuranceClaimStatusDto,
} from './dto/insurance.dto';
import { PatientsService } from '../patients/patients.service';

@Injectable()
export class InsuranceService {
  constructor(
    @InjectRepository(InsuranceClaim) private readonly claimRepo: Repository<InsuranceClaim>,
    @InjectRepository(Invoice) private readonly invoiceRepo: Repository<Invoice>,
    private readonly patientsService: PatientsService,
  ) {}

  private async nextClaimNumber(): Promise<string> {
    const count = await this.claimRepo.count();
    return `CLM-${String(count + 1).padStart(5, '0')}`;
  }

  async createClaim(dto: CreateInsuranceClaimDto, userId: string): Promise<InsuranceClaim> {
    const invoice = await this.invoiceRepo.findOne({ where: { id: dto.invoiceId } });
    if (!invoice) throw new NotFoundException(`Invoice ${dto.invoiceId} not found`);

    const claim = this.claimRepo.create({
      claimNumber: await this.nextClaimNumber(),
      invoice,
      providerName: dto.providerName,
      policyNumber: dto.policyNumber,
      claimAmount: dto.claimAmount,
      notes: dto.notes,
      status: InsuranceClaimStatus.SUBMITTED,
      submittedBy: { id: userId } as any,
    });
    return this.claimRepo.save(claim);
  }

  async listClaims(page = 1, limit = 20, status?: string, invoiceId?: string) {
    const qb = this.claimRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.invoice', 'invoice')
      .leftJoinAndSelect('invoice.patient', 'patient')
      .orderBy('c.createdAt', 'DESC');
    if (status) qb.andWhere('c.status = :status', { status });
    if (invoiceId) qb.andWhere('invoice.id = :invoiceId', { invoiceId });
    const [data, total] = await qb.skip((page - 1) * limit).take(limit).getManyAndCount();
    return { data, total, page, pages: Math.ceil(total / limit) };
  }

  async findById(id: string): Promise<InsuranceClaim> {
    const claim = await this.claimRepo.findOne({ where: { id } });
    if (!claim) throw new NotFoundException(`Claim ${id} not found`);
    return claim;
  }

  async updateStatus(id: string, dto: UpdateInsuranceClaimStatusDto): Promise<InsuranceClaim> {
    const claim = await this.findById(id);
    claim.status = dto.status;
    if (dto.externalClaimId !== undefined) claim.externalClaimId = dto.externalClaimId;
    if (dto.notes !== undefined) claim.notes = dto.notes;
    if (dto.status === InsuranceClaimStatus.REJECTED && dto.denialReason) {
      claim.denialReason = dto.denialReason;
    }
    if (dto.status !== InsuranceClaimStatus.REJECTED) {
      claim.denialReason = dto.denialReason ?? claim.denialReason;
    }
    return this.claimRepo.save(claim);
  }

  async checkEligibility(dto: CheckEligibilityDto) {
    const patient = await this.patientsService.findById(dto.patientId);
    const policy = (dto.policyNumber ?? '').trim() || 'UNKNOWN';
    const eligible = !policy.toUpperCase().includes('EXPIRED');
    return {
      patientId: patient.id,
      patientName: patient.name,
      providerName: dto.providerName,
      policyNumber: policy,
      eligible,
      coverageType: eligible ? 'in-network' : 'none',
      copayInr: eligible ? 500 : 0,
      deductibleRemainingInr: eligible ? 15000 : null,
      checkedAt: new Date().toISOString(),
      source: 'mvp-stub',
      message: eligible
        ? 'Demo eligibility response — not connected to a live payer clearinghouse.'
        : 'Policy appears inactive in demo rules (contains EXPIRED).',
    };
  }

  build837ProfessionalClaim(claim: InsuranceClaim) {
    return {
      format: '837P-mvp-json',
      version: '005010',
      claimNumber: claim.claimNumber,
      externalClaimId: claim.externalClaimId ?? null,
      status: claim.status,
      providerName: claim.providerName,
      policyNumber: claim.policyNumber ?? null,
      claimAmount: Number(claim.claimAmount),
      denialReason: claim.denialReason ?? null,
      invoice: claim.invoice
        ? {
            invoiceNumber: claim.invoice.invoiceNumber,
            totalAmount: Number(claim.invoice.totalAmount),
            patient: claim.invoice.patient
              ? { uhid: claim.invoice.patient.uhid, name: claim.invoice.patient.name }
              : null,
          }
        : null,
      generatedAt: new Date().toISOString(),
      disclaimer: 'MVP export for demo — not X12 EDI. Wire to clearinghouse in production.',
    };
  }

  async exportClaim837(id: string) {
    const claim = await this.claimRepo.findOne({
      where: { id },
      relations: ['invoice', 'invoice.patient'],
    });
    if (!claim) throw new NotFoundException(`Claim ${id} not found`);
    return this.build837ProfessionalClaim(claim);
  }

  async appealClaim(id: string, dto: AppealInsuranceClaimDto): Promise<InsuranceClaim> {
    const claim = await this.findById(id);
    if (claim.status !== InsuranceClaimStatus.REJECTED) {
      throw new BadRequestException('Only rejected claims can be appealed');
    }
    claim.status = InsuranceClaimStatus.PROCESSING;
    claim.appealNotes = dto.appealNotes;
    const stamp = `[Appeal ${new Date().toISOString()}] ${dto.appealNotes}`;
    claim.notes = claim.notes ? `${claim.notes}\n${stamp}` : stamp;
    return this.claimRepo.save(claim);
  }

  async listDenials(page = 1, limit = 20) {
    return this.listClaims(page, limit, InsuranceClaimStatus.REJECTED);
  }
}
