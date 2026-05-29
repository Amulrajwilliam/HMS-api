import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HospitalAppSettings } from '../../modules/admin/entities/hospital-app-settings.entity';
import { normalizeHospitalSettings } from '../../modules/admin/hospital-settings.defaults';

const SETTINGS_CACHE_MS = 30_000;

@Injectable()
export class PasswordPolicyService {
  private cache: { at: number; minLength: number } | null = null;

  constructor(
    @InjectRepository(HospitalAppSettings)
    private readonly hospitalSettingsRepo: Repository<HospitalAppSettings>,
  ) {}

  async getMinLength(): Promise<number> {
    const now = Date.now();
    if (this.cache && now - this.cache.at < SETTINGS_CACHE_MS) {
      return this.cache.minLength;
    }
    try {
      const row = await this.hospitalSettingsRepo.findOne({ where: { id: 'singleton' } });
      const sec = normalizeHospitalSettings(row?.settings ?? {}).security;
      const minLength = Math.max(6, Math.min(128, sec.passwordMinLength || 8));
      this.cache = { at: now, minLength };
      return minLength;
    } catch {
      this.cache = { at: now, minLength: 8 };
      return 8;
    }
  }

  async assertValid(plainPassword: string): Promise<void> {
    const minLength = await this.getMinLength();
    if (!plainPassword || plainPassword.length < minLength) {
      throw new BadRequestException(`Password must be at least ${minLength} characters`);
    }
  }
}
