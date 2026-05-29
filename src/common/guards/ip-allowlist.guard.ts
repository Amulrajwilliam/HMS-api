import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { HospitalAppSettings } from '../../modules/admin/entities/hospital-app-settings.entity';
import { normalizeHospitalSettings } from '../../modules/admin/hospital-settings.defaults';
import { clientIpFromRequest, ipMatchesAny } from '../utils/ip-allowlist.util';

const SINGLETON = 'singleton';

@Injectable()
export class IpAllowlistGuard implements CanActivate {
  private cache: { until: number; security: ReturnType<typeof normalizeHospitalSettings>['security'] } | null = null;

  constructor(
    private reflector: Reflector,
    @InjectRepository(HospitalAppSettings) private readonly settingsRepo: Repository<HospitalAppSettings>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const sec = await this.getSecurity();
    if (!sec.ipWhitelist) return true;
    if (!sec.allowedIps?.length) return true;

    const req = context.switchToHttp().getRequest<Request>();

    // Dev: Vite proxy connects from loopback; X-Forwarded-For may be the browser IP not on the allowlist.
    if (process.env.NODE_ENV !== 'production') {
      const socketIp = (req.socket?.remoteAddress ?? '').replace(/^::ffff:/i, '');
      if (socketIp === '127.0.0.1' || socketIp === '::1') return true;
    }

    const client = clientIpFromRequest(req);
    if (client === '127.0.0.1' || client === '::1') return true;

    if (ipMatchesAny(client, sec.allowedIps)) return true;

    throw new ForbiddenException('Your IP address is not allowed to access this API.');
  }

  private async getSecurity() {
    const now = Date.now();
    if (this.cache && now < this.cache.until) {
      return this.cache.security;
    }
    try {
      const row = await this.settingsRepo.findOne({ where: { id: SINGLETON } });
      const security = normalizeHospitalSettings(row?.settings ?? {}).security;
      this.cache = { until: now + 30_000, security };
      return security;
    } catch {
      const security = normalizeHospitalSettings({}).security;
      this.cache = { until: now + 10_000, security };
      return security;
    }
  }
}
