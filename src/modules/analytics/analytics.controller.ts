import { Controller, Get, Post, Query, Header, Param, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AnalyticsService } from './analytics.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ANALYTICS_EXPORT_QUEUE } from './analytics-export.processor';

@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly svc: AnalyticsService,
    @InjectQueue(ANALYTICS_EXPORT_QUEUE) private readonly exportQueue: Queue,
  ) {}

  @Get('overview')
  @Roles(Role.ADMIN, Role.BILLING)
  overview(@CurrentUser() user: any) {
    return this.svc.getOverview(user);
  }

  @Get('revenue-trend')
  @Roles(Role.ADMIN, Role.BILLING)
  revenueTrend(@Query('months') months?: string) {
    return this.svc.getRevenueTrend(months ? +months : 6);
  }

  @Get('patient-insights')
  @Roles(Role.ADMIN, Role.BILLING)
  patientInsights() {
    return this.svc.getPatientInsights();
  }

  @Get('doctor-performance')
  @Roles(Role.ADMIN, Role.DOCTOR, Role.BILLING)
  doctorPerformance(@CurrentUser() user: any, @Query('limit') limit?: string) {
    return this.svc.getDoctorPerformance(user, limit ? +limit : 15);
  }

  @Get('export/overview.csv')
  @Roles(Role.ADMIN, Role.BILLING)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="hms-analytics-overview.csv"')
  async exportOverviewCsv() {
    return this.svc.getOverviewCsv();
  }

  /** Enqueue CSV build on BullMQ (Redis). Poll `GET export/jobs/:jobId` until `completed`. */
  @Post('export/jobs')
  @Roles(Role.ADMIN, Role.BILLING)
  async enqueueExport(@CurrentUser() user: any) {
    const job = await this.exportQueue.add(
      'overview-csv',
      { requestedBy: user?.id },
      { removeOnComplete: 50, removeOnFail: 20, attempts: 2, backoff: { type: 'exponential', delay: 2000 } },
    );
    return { jobId: String(job.id) };
  }

  @Get('export/jobs/:jobId')
  @Roles(Role.ADMIN, Role.BILLING)
  async getExportJob(@Param('jobId') jobId: string) {
    const job = await this.exportQueue.getJob(jobId);
    if (!job) throw new NotFoundException('Export job not found');
    const state = await job.getState();
    if (state === 'completed') {
      const val = job.returnvalue as { csv?: string } | undefined;
      return { state, csv: val?.csv ?? '' };
    }
    if (state === 'failed') {
      return { state, reason: job.failedReason };
    }
    return { state };
  }
}
