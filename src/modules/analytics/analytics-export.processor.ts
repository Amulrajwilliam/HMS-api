import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AnalyticsService } from './analytics.service';

export const ANALYTICS_EXPORT_QUEUE = 'analytics-export';

@Processor(ANALYTICS_EXPORT_QUEUE, { concurrency: 2 })
export class AnalyticsExportProcessor extends WorkerHost {
  constructor(private readonly analyticsService: AnalyticsService) {
    super();
  }

  async process(_job: Job): Promise<{ csv: string }> {
    const csv = await this.analyticsService.getOverviewCsv();
    return { csv };
  }
}
