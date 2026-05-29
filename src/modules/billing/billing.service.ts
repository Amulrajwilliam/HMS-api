import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Invoice, InvoiceItem, Payment, InvoiceStatus } from './entities/invoice.entity';
import { BillableService } from '../admin/entities/billable-service.entity';
import { CreateInvoiceDto, CreatePaymentDto, InvoiceItemDto } from './dto/billing.dto';
import { PatientsService } from '../patients/patients.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(Invoice) private invoiceRepo: Repository<Invoice>,
    @InjectRepository(InvoiceItem) private itemRepo: Repository<InvoiceItem>,
    @InjectRepository(Payment) private paymentRepo: Repository<Payment>,
    @InjectRepository(BillableService) private billableServiceRepo: Repository<BillableService>,
    private patientsService: PatientsService,
    private usersService: UsersService,
  ) {}

  private async generateInvoiceNumber(): Promise<string> {
    const count = await this.invoiceRepo.count({ withDeleted: true });
    return `INV-${String(count + 1).padStart(4, '0')}`;
  }

  private async generateReceiptNumber(): Promise<string> {
    const count = await this.paymentRepo.count();
    return `RCP-${String(count + 1).padStart(4, '0')}`;
  }

  async listActiveBillableServices() {
    return this.billableServiceRepo.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
  }

  private async resolveInvoiceItem(dto: InvoiceItemDto): Promise<InvoiceItem> {
    const item = new InvoiceItem();

    if (dto.billableServiceId) {
      const svc = await this.billableServiceRepo.findOne({
        where: { id: dto.billableServiceId, isActive: true },
      });
      if (!svc) {
        throw new BadRequestException(`Billable service ${dto.billableServiceId} not found or inactive`);
      }
      item.billableServiceId = svc.id;
      item.description = dto.description?.trim() || svc.name;
      item.unitPrice = dto.unitPrice ?? Number(svc.defaultPrice);
    } else {
      const description = dto.description?.trim();
      if (!description) {
        throw new BadRequestException('Each line item needs a description or billableServiceId');
      }
      if (dto.unitPrice == null || dto.unitPrice <= 0) {
        throw new BadRequestException('Each manual line item needs a positive unitPrice');
      }
      item.description = description;
      item.unitPrice = dto.unitPrice;
      item.billableServiceId = null;
    }

    item.quantity = dto.quantity;
    item.amount = item.quantity * Number(item.unitPrice);
    return item;
  }

  async createInvoice(dto: CreateInvoiceDto): Promise<Invoice> {
    const patient = await this.patientsService.findById(dto.patientId);
    const doctor = dto.doctorId ? await this.usersService.findById(dto.doctorId) : null;

    const items = await Promise.all(dto.items.map((i) => this.resolveInvoiceItem(i)));

    const subtotal = items.reduce((s, i) => s + Number(i.amount), 0);
    const taxRate = dto.taxRate ?? 18;
    const taxAmount = Math.round((subtotal * taxRate) / 100);
    const discount = dto.discount ?? 0;
    const totalAmount = subtotal + taxAmount - discount;

    const invoiceNumber = await this.generateInvoiceNumber();
    const invoice = this.invoiceRepo.create({
      invoiceNumber, patient, doctor: doctor ?? undefined,
      items, subtotal, taxRate, taxAmount, discount, totalAmount, paidAmount: 0,
      status: InvoiceStatus.PENDING,
      dueDate: dto.dueDate,
      notes: dto.notes,
    });
    return this.invoiceRepo.save(invoice);
  }

  async findAllInvoices(page = 1, limit = 20, status?: string, patientId?: string) {
    const qb = this.invoiceRepo.createQueryBuilder('inv')
      .leftJoinAndSelect('inv.patient', 'patient')
      .orderBy('inv.createdAt', 'DESC');
    if (status) qb.andWhere('inv.status = :status', { status });
    if (patientId) qb.andWhere('patient.id = :patientId', { patientId });
    const [data, total] = await qb.skip((page - 1) * limit).take(limit).getManyAndCount();
    return { data, total, page, pages: Math.ceil(total / limit) };
  }

  async findInvoicesForPatient(
    currentUser: { id?: string; email?: string },
    page = 1,
    limit = 20,
    status?: string,
  ) {
    const patient = await this.patientsService.findOwnedProfileByUser(currentUser);
    return this.findAllInvoices(page, limit, status, patient.id);
  }

  async findInvoiceById(
    id: string,
    currentUser?: { role?: string; id?: string; email?: string },
  ): Promise<Invoice> {
    const inv = await this.invoiceRepo.findOne({
      where: { id },
      relations: ['patient', 'doctor', 'items'],
    });
    if (!inv) throw new NotFoundException(`Invoice ${id} not found`);

    this.assertCanAccessInvoice(inv, currentUser);
    return inv;
  }

  async recordPaymentForPatient(
    currentUser: { id?: string; email?: string; role?: string },
    dto: CreatePaymentDto,
  ): Promise<Payment> {
    await this.findInvoiceById(dto.invoiceId, currentUser);
    return this.recordPayment(dto);
  }

  async recordPayment(dto: CreatePaymentDto): Promise<Payment> {
    const invoice = await this.findInvoiceById(dto.invoiceId);
    const balance = Number(invoice.totalAmount) - Number(invoice.paidAmount);
    if (dto.amount > balance) throw new BadRequestException('Payment exceeds balance due');

    const receiptNumber = await this.generateReceiptNumber();
    const payment = this.paymentRepo.create({ ...dto, invoice, receiptNumber });
    await this.paymentRepo.save(payment);

    const newPaid = Number(invoice.paidAmount) + dto.amount;
    const newStatus = newPaid >= Number(invoice.totalAmount)
      ? InvoiceStatus.PAID
      : InvoiceStatus.PARTIAL;
    await this.invoiceRepo.update(invoice.id, { paidAmount: newPaid, status: newStatus });

    return payment;
  }

  private assertCanAccessInvoice(
    inv: Invoice,
    currentUser?: { role?: string; id?: string; email?: string },
  ) {
    if (!currentUser || currentUser.role !== 'patient') return;
    const byUserId = Boolean(inv.patient?.userId && currentUser.id && inv.patient.userId === currentUser.id);
    const byEmail = Boolean(
      inv.patient?.email &&
        currentUser.email &&
        inv.patient.email.toLowerCase() === currentUser.email.toLowerCase(),
    );
    if (!byUserId && !byEmail) {
      throw new ForbiddenException('You can only access your own billing records');
    }
  }

  async findPaymentById(
    id: string,
    currentUser?: { role?: string; id?: string; email?: string },
  ): Promise<Payment> {
    const p = await this.paymentRepo.findOne({
      where: { id },
      relations: ['invoice', 'invoice.patient'],
    });
    if (!p) throw new NotFoundException(`Payment ${id} not found`);
    if (p.invoice) this.assertCanAccessInvoice(p.invoice, currentUser);
    return p;
  }

  async findPaymentsByInvoice(
    invoiceId: string,
    currentUser?: { role?: string; id?: string; email?: string },
  ): Promise<Payment[]> {
    const inv = await this.findInvoiceById(invoiceId, currentUser);
    return this.paymentRepo.find({
      where: { invoice: { id: inv.id } },
      order: { paidAt: 'DESC' },
    });
  }

  async getRevenueSummary() {
    const result = await this.invoiceRepo
      .createQueryBuilder('inv')
      .select('SUM(inv.paidAmount)', 'totalRevenue')
      .addSelect('SUM(inv.totalAmount - inv.paidAmount)', 'outstanding')
      .addSelect('COUNT(*)', 'totalInvoices')
      .getRawOne();
    return result;
  }

  /** Mark open invoices past due date as overdue (MVP AR engine). */
  async syncOverdueStatus(): Promise<number> {
    const today = new Date().toISOString().slice(0, 10);
    const res = await this.invoiceRepo
      .createQueryBuilder()
      .update(Invoice)
      .set({ status: InvoiceStatus.OVERDUE })
      .where('status IN (:...statuses)', {
        statuses: [InvoiceStatus.PENDING, InvoiceStatus.PARTIAL],
      })
      .andWhere('dueDate IS NOT NULL')
      .andWhere('dueDate < :today', { today })
      .andWhere('paidAmount < totalAmount')
      .execute();
    return res.affected ?? 0;
  }

  private invoiceBalance(inv: Invoice): number {
    return Math.max(0, Number(inv.totalAmount) - Number(inv.paidAmount));
  }

  private daysPastDue(inv: Invoice): number {
    const anchor = inv.dueDate ?? (inv.createdAt instanceof Date
      ? inv.createdAt.toISOString().slice(0, 10)
      : String(inv.createdAt).slice(0, 10));
    const due = new Date(`${anchor}T12:00:00`);
    const now = new Date();
    return Math.max(0, Math.floor((now.getTime() - due.getTime()) / (24 * 3600 * 1000)));
  }

  async getArAging() {
    await this.syncOverdueStatus();
    const openStatuses = [InvoiceStatus.PENDING, InvoiceStatus.PARTIAL, InvoiceStatus.OVERDUE];
    const rows = await this.invoiceRepo.find({
      where: { status: In(openStatuses) },
      relations: ['patient'],
      order: { dueDate: 'ASC', createdAt: 'ASC' },
    });

    const buckets = {
      current: { label: '0–30 days', count: 0, balance: 0, invoices: [] as any[] },
      days31_60: { label: '31–60 days', count: 0, balance: 0, invoices: [] as any[] },
      days61_90: { label: '61–90 days', count: 0, balance: 0, invoices: [] as any[] },
      over90: { label: '90+ days', count: 0, balance: 0, invoices: [] as any[] },
    };

    let totalBalance = 0;
    for (const inv of rows) {
      const balance = this.invoiceBalance(inv);
      if (balance <= 0) continue;
      totalBalance += balance;
      const days = this.daysPastDue(inv);
      const summary = {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        patientName: inv.patient?.name,
        status: inv.status,
        dueDate: inv.dueDate,
        balance,
        daysPastDue: days,
      };
      let bucket: keyof typeof buckets = 'current';
      if (days > 90) bucket = 'over90';
      else if (days > 60) bucket = 'days61_90';
      else if (days > 30) bucket = 'days31_60';
      buckets[bucket].count += 1;
      buckets[bucket].balance += balance;
      buckets[bucket].invoices.push(summary);
    }

    return {
      asOf: new Date().toISOString(),
      totalOpenBalance: totalBalance,
      totalOpenInvoices: rows.filter((r) => this.invoiceBalance(r) > 0).length,
      buckets: [
        buckets.current,
        buckets.days31_60,
        buckets.days61_90,
        buckets.over90,
      ],
    };
  }

  async listDunningCandidates() {
    await this.syncOverdueStatus();
    const rows = await this.invoiceRepo.find({
      where: [
        { status: InvoiceStatus.OVERDUE },
        { status: InvoiceStatus.PARTIAL },
        { status: InvoiceStatus.PENDING },
      ],
      relations: ['patient'],
      order: { dueDate: 'ASC' },
    });
    return rows
      .map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        patientName: inv.patient?.name,
        status: inv.status,
        dueDate: inv.dueDate,
        balance: this.invoiceBalance(inv),
        daysPastDue: this.daysPastDue(inv),
        notes: inv.notes,
      }))
      .filter((r) => r.balance > 0 && r.daysPastDue >= 1);
  }

  async sendDunningReminder(invoiceId: string) {
    const inv = await this.findInvoiceById(invoiceId);
    const balance = this.invoiceBalance(inv);
    if (balance <= 0) {
      throw new BadRequestException('Invoice has no balance due');
    }
    const stamp = `[Dunning ${new Date().toISOString()}] Payment reminder — balance due ₹${balance.toLocaleString('en-IN')}.`;
    inv.notes = inv.notes ? `${inv.notes}\n${stamp}` : stamp;
    if (inv.status === InvoiceStatus.PENDING || inv.status === InvoiceStatus.PARTIAL) {
      inv.status = InvoiceStatus.OVERDUE;
    }
    await this.invoiceRepo.save(inv);
    return {
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      balance,
      message: 'Dunning reminder recorded on invoice (MVP — connect to SMS/email in production).',
      stampedNote: stamp,
    };
  }
}
