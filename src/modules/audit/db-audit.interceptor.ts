import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
import { AuditEvent } from './audit-event.entity';
import { HospitalAppSettings } from '../admin/entities/hospital-app-settings.entity';
import { normalizeHospitalSettings } from '../admin/hospital-settings.defaults';

const MUTATIONS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class DbAuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(DbAuditInterceptor.name);
  private auditEnabledCache: { until: number; enabled: boolean } = { until: 0, enabled: true };

  constructor(
    @InjectRepository(AuditEvent) private readonly auditRepo: Repository<AuditEvent>,
    @InjectRepository(HospitalAppSettings) private readonly settingsRepo: Repository<HospitalAppSettings>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const method = (req.method || 'GET').toUpperCase();
    if (!MUTATIONS.has(method)) {
      return next.handle();
    }

    const started = Date.now();
    let sawError = false;
    return next.handle().pipe(
      tap({
        error: (err: unknown) => {
          sawError = true;
          void this.persist(req, started, 'error', err);
        },
        finalize: () => {
          if (!sawError) void this.persist(req, started, 'success', null);
        },
      }),
    );
  }

  private async isAuditEnabled(): Promise<boolean> {
    if (Date.now() < this.auditEnabledCache.until) {
      return this.auditEnabledCache.enabled;
    }
    try {
      const row = await this.settingsRepo.findOne({ where: { id: 'singleton' } });
      const enabled = normalizeHospitalSettings(row?.settings ?? {}).security.auditLog;
      this.auditEnabledCache = { until: Date.now() + 30_000, enabled };
      return enabled;
    } catch {
      this.auditEnabledCache = { until: Date.now() + 10_000, enabled: true };
      return true;
    }
  }

  private async persist(req: Request, started: number, outcome: 'success' | 'error', err: unknown) {
    try {
      if (!(await this.isAuditEnabled())) {
        return;
      }
      const user = (req as Request & { user?: { id?: string; email?: string; role?: string } }).user;
      const path = truncatePath(req.originalUrl || req.url || '', 2048);
      const durationMs = Math.max(0, Date.now() - started);
      const errorSummary = outcome === 'error' ? truncateErr(err) : null;

      await this.auditRepo.insert({
        userId: user?.id ?? null,
        userEmail: user?.email ? truncate(user.email, 255) : null,
        role: user?.role ? truncate(String(user.role), 32) : null,
        method: (req.method || 'GET').toUpperCase(),
        path,
        ip: truncate(String((req as Request & { ip?: string }).ip ?? req.socket?.remoteAddress ?? ''), 128),
        durationMs,
        outcome,
        errorSummary,
      });
    } catch (e) {
      this.logger.warn(`Audit persist failed: ${(e as Error).message}`);
    }
  }
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function truncatePath(url: string, max: number): string {
  const noQuery = url.split('?')[0] ?? url;
  return truncate(noQuery, max);
}

function truncateErr(err: unknown): string | null {
  if (err === null || err === undefined) return null;
  const msg =
    typeof err === 'object' && err !== null && 'message' in err
      ? String((err as { message?: unknown }).message)
      : String(err);
  const t = msg.trim();
  return t.length ? truncate(t, 512) : null;
}
