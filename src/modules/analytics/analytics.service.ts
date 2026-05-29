import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice } from '../billing/entities/invoice.entity';
import { Patient } from '../patients/entities/patient.entity';
import { Appointment, AppointmentStatus } from '../appointments/entities/appointment.entity';
import { EmrRecord } from '../emr/entities/emr-record.entity';
import { BillingService } from '../billing/billing.service';
import { Role } from '../../common/enums/roles.enum';

type CurrentUser = { id?: string; role?: string };

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Invoice) private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(Patient) private readonly patientRepo: Repository<Patient>,
    @InjectRepository(Appointment) private readonly appointmentRepo: Repository<Appointment>,
    @InjectRepository(EmrRecord) private readonly emrRepo: Repository<EmrRecord>,
    private readonly billingService: BillingService,
  ) {}

  async getOverview(user: CurrentUser) {
    const revenue = await this.billingService.getRevenueSummary();
    const totalPatients = await this.patientRepo.count();

    const patientsByStatus = await this.patientRepo
      .createQueryBuilder('p')
      .select('p.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('p.status')
      .getRawMany();

    const since = new Date();
    since.setDate(since.getDate() - 30);
    const apptLast30 = await this.appointmentRepo
      .createQueryBuilder('a')
      .where('a.date >= :d', { d: since.toISOString().slice(0, 10) })
      .getCount();

    const appointmentsByStatus = await this.appointmentRepo
      .createQueryBuilder('a')
      .select('a.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('a.status')
      .getRawMany();

    const emrLast30 = await this.emrRepo
      .createQueryBuilder('e')
      .where('e.createdAt >= :s', { s: since })
      .getCount();

    const doctorSlice = await this.getDoctorPerformance(user, 8);

    return {
      revenue: {
        totalPaid: Number(revenue?.totalRevenue ?? 0),
        outstanding: Number(revenue?.outstanding ?? 0),
        invoiceCount: Number(revenue?.totalInvoices ?? 0),
      },
      patients: {
        total: totalPatients,
        byStatus: patientsByStatus.map((r) => ({
          status: r.status,
          count: Number(r.count),
        })),
      },
      appointments: {
        last30Days: apptLast30,
        byStatus: appointmentsByStatus.map((r) => ({
          status: r.status,
          count: Number(r.count),
        })),
      },
      emr: { recordsLast30Days: emrLast30 },
      doctors: doctorSlice,
    };
  }

  async getRevenueTrend(months = 6) {
    const m = Math.min(Math.max(Number(months) || 6, 1), 24);
    const start = new Date();
    start.setMonth(start.getMonth() - (m - 1));
    start.setDate(1);
    start.setHours(0, 0, 0, 0);

    const rows = await this.invoiceRepo
      .createQueryBuilder('inv')
      .select(`date_trunc('month', inv.createdAt)`, 'month')
      .addSelect('SUM(inv.paidAmount)', 'paid')
      .addSelect('SUM(inv.totalAmount)', 'billed')
      .where('inv.createdAt >= :start', { start })
      .groupBy(`date_trunc('month', inv.createdAt)`)
      .orderBy('month', 'ASC')
      .getRawMany();

    return {
      months: m,
      points: rows.map((r) => ({
        month: r.month instanceof Date ? r.month.toISOString().slice(0, 10) : String(r.month).slice(0, 10),
        paid: Number(r.paid ?? 0),
        billed: Number(r.billed ?? 0),
      })),
    };
  }

  async getPatientInsights() {
    const total = await this.patientRepo.count();
    const last30 = new Date();
    last30.setDate(last30.getDate() - 30);
    const newPatients = await this.patientRepo
      .createQueryBuilder('p')
      .where('p.createdAt >= :s', { s: last30 })
      .getCount();

    const byStatus = await this.patientRepo
      .createQueryBuilder('p')
      .select('p.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('p.status')
      .getRawMany();

    return {
      total,
      newLast30Days: newPatients,
      byStatus: byStatus.map((r) => ({ status: r.status, count: Number(r.count) })),
    };
  }

  async getDoctorPerformance(user: CurrentUser, limit = 15) {
    const qb = this.appointmentRepo
      .createQueryBuilder('a')
      .innerJoin('a.doctor', 'd')
      .select('d.id', 'doctorId')
      .addSelect('d.name', 'doctorName')
      .addSelect(
        `SUM(CASE WHEN a.status = :done THEN 1 ELSE 0 END)`,
        'completed',
      )
      .addSelect('COUNT(a.id)', 'total')
      .setParameter('done', AppointmentStatus.COMPLETED)
      .groupBy('d.id')
      .addGroupBy('d.name')
      .orderBy('completed', 'DESC')
      .addOrderBy('total', 'DESC')
      .take(limit);

    if (user.role === Role.DOCTOR && user.id) {
      qb.andWhere('d.id = :uid', { uid: user.id });
    }

    const rows = await qb.getRawMany();
    return rows.map((r) => ({
      doctorId: r.doctorId,
      doctorName: r.doctorName,
      completed: Number(r.completed ?? 0),
      total: Number(r.total ?? 0),
    }));
  }

  async getOverviewCsv(): Promise<string> {
    const o = await this.getOverview({});
    const lines = [
      'metric,value',
      `total_patients,${o.patients.total}`,
      `invoices,${o.revenue.invoiceCount}`,
      `paid_total,${o.revenue.totalPaid}`,
      `outstanding,${o.revenue.outstanding}`,
      `appointments_last_30d,${o.appointments.last30Days}`,
      `emr_records_last_30d,${o.emr.recordsLast30Days}`,
    ];
    for (const s of o.patients.byStatus) {
      lines.push(`patient_status_${s.status},${s.count}`);
    }
    return lines.join('\n');
  }
}
