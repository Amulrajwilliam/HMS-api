import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditEvent } from './audit-event.entity';

@Injectable()
export class AuditEventsService {
  constructor(
    @InjectRepository(AuditEvent) private readonly repo: Repository<AuditEvent>,
  ) {}

  async findPage(page: number, limit: number) {
    const take = Math.min(100, Math.max(1, limit));
    const skip = (Math.max(1, page) - 1) * take;
    const [data, total] = await this.repo.findAndCount({
      order: { createdAt: 'DESC' },
      take,
      skip,
    });
    return {
      data: data.map((e) => ({
        id: e.id,
        createdAt: e.createdAt.toISOString(),
        userId: e.userId,
        userEmail: e.userEmail,
        role: e.role,
        method: e.method,
        path: e.path,
        ip: e.ip,
        durationMs: e.durationMs,
        outcome: e.outcome,
        errorSummary: e.errorSummary,
      })),
      page: Math.max(1, page),
      limit: take,
      total,
    };
  }
}
