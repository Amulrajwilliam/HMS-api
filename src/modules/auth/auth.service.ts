import {
  Injectable,
  UnauthorizedException,
  HttpException,
  HttpStatus,
  Logger,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { generateSecret, generateURI, verifySync } from 'otplib';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { User } from '../users/entities/user.entity';
import { OtpCode } from './entities/otp-code.entity';
import { OtpDeliveryService } from './otp-delivery.service';
import { HospitalAppSettings } from '../admin/entities/hospital-app-settings.entity';
import { normalizeHospitalSettings } from '../admin/hospital-settings.defaults';
import { Role } from '../../common/enums/roles.enum';
import { EphemeralStoreService } from '../../common/services/ephemeral-store.service';

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_WINDOW_MS = 15 * 60 * 1000;
const OTP_MAX_REQUESTS_PER_WINDOW = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;
const SETTINGS_CACHE_MS = 30_000;

/** TOTP clock skew tolerance in seconds (±60s ≈ one period each side). */
const TOTP_EPOCH_TOLERANCE_SEC = 60;
const TOTP_SETUP_TTL_MS = 10 * 60 * 1000;

function normalizeTotpCode(code: string): string {
  return code.replace(/\s+/g, '').replace(/\D/g, '');
}

function normalizeTotpSecret(secret: string): string {
  return secret.replace(/\s+/g, '').toUpperCase();
}

function verifyTotpCode(secret: string, code: string): boolean {
  const normalizedSecret = normalizeTotpSecret(secret);
  const normalizedCode = normalizeTotpCode(code);
  if (normalizedCode.length < 6) return false;
  return verifySync({
    secret: normalizedSecret,
    token: normalizedCode,
    epochTolerance: TOTP_EPOCH_TOLERANCE_SEC,
  }).valid;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private hospitalSettingsCache: {
    at: number;
    security: ReturnType<typeof normalizeHospitalSettings>['security'];
  } | null = null;

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private config: ConfigService,
    @InjectRepository(OtpCode) private otpRepo: Repository<OtpCode>,
    @InjectRepository(HospitalAppSettings) private hospitalSettingsRepo: Repository<HospitalAppSettings>,
    private otpDelivery: OtpDeliveryService,
    private ephemeralStore: EphemeralStoreService,
  ) {}

  async login(dto: LoginDto) {
    const emailKey = dto.email.trim().toLowerCase();
    await this.clearExpiredLock(emailKey);

    const lock = await this.ephemeralStore.getJson<{ attempts: number; lockedUntil?: number }>(
      `login:${emailKey}`,
    );
    if (lock?.lockedUntil && Date.now() < lock.lockedUntil) {
      throw new HttpException('Too many login attempts. Try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const user = await this.usersService.findByEmailWithCredentials(dto.email);
    if (!user) {
      await this.registerFailedLogin(emailKey);
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.isActive) throw new UnauthorizedException('Account is disabled');

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) {
      await this.registerFailedLogin(emailKey);
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.ephemeralStore.delete(`login:${emailKey}`);

    const challenge = await this.maybeTwoFactorChallenge(user);
    if (challenge) return challenge;

    const tokens = await this.generateTokens(user);
    await this.usersService.updateRefreshToken(user.id, tokens.refreshToken);

    return {
      user: this.toPublicUser(user),
      securityPolicy: await this.buildSecurityPolicyForUser(user),
      ...tokens,
    };
  }

  private loginLockKey(emailKey: string) {
    return `login:${emailKey}`;
  }

  private async clearExpiredLock(emailKey: string) {
    const cur = await this.ephemeralStore.getJson<{ attempts: number; lockedUntil?: number }>(
      this.loginLockKey(emailKey),
    );
    if (cur?.lockedUntil && Date.now() >= cur.lockedUntil) {
      await this.ephemeralStore.delete(this.loginLockKey(emailKey));
    }
  }

  private async getHospitalSecurityCached() {
    const now = Date.now();
    if (this.hospitalSettingsCache && now - this.hospitalSettingsCache.at < SETTINGS_CACHE_MS) {
      return this.hospitalSettingsCache.security;
    }
    try {
      const row = await this.hospitalSettingsRepo.findOne({ where: { id: 'singleton' } });
      const security = normalizeHospitalSettings(row?.settings ?? {}).security;
      this.hospitalSettingsCache = { at: now, security };
      return security;
    } catch {
      const security = normalizeHospitalSettings({}).security;
      this.hospitalSettingsCache = { at: now, security };
      return security;
    }
  }

  private async getMaxLoginAttempts(): Promise<number> {
    const sec = await this.getHospitalSecurityCached();
    return Math.max(3, Math.min(50, Number.isFinite(sec.maxLoginAttempts) ? sec.maxLoginAttempts : 5));
  }

  private async registerFailedLogin(emailKey: string) {
    const max = await this.getMaxLoginAttempts();
    const key = this.loginLockKey(emailKey);
    const cur =
      (await this.ephemeralStore.getJson<{ attempts: number; lockedUntil?: number }>(key)) ?? {
        attempts: 0,
      };
    cur.attempts += 1;
    if (cur.attempts >= max) {
      cur.lockedUntil = Date.now() + LOGIN_LOCKOUT_MS;
      cur.attempts = 0;
    }
    await this.ephemeralStore.setJson(key, cur, LOGIN_LOCKOUT_MS);
  }

  private isStaffRole(role: Role): boolean {
    return role !== Role.PATIENT;
  }

  private userRequiresTwoFactor(user: User, sec: Awaited<ReturnType<AuthService['getHospitalSecurityCached']>>): boolean {
    if (user.role === Role.ADMIN && sec.enforce2faAdmin) return true;
    if (this.isStaffRole(user.role) && sec.enforce2faStaff) return true;
    return false;
  }

  private async buildSecurityPolicyForUser(user: User) {
    const sec = await this.getHospitalSecurityCached();
    const mustEnable2fa = this.userRequiresTwoFactor(user, sec) && !user.totpEnabled;
    return {
      sessionTimeoutMinutes: sec.sessionTimeoutMinutes,
      enforce2faAdmin: sec.enforce2faAdmin,
      enforce2faStaff: sec.enforce2faStaff,
      mustEnable2fa,
    };
  }

  /** When 2FA is enforced for the role, return a challenge instead of tokens. */
  private async maybeTwoFactorChallenge(user: User) {
    const sec = await this.getHospitalSecurityCached();
    if (!this.userRequiresTwoFactor(user, sec)) return null;

    if (!user.totpEnabled) {
      const scope =
        user.role === Role.ADMIN
          ? 'administrator'
          : 'staff';
      throw new ForbiddenException(
        `Two-factor authentication must be enabled on this ${scope} account. An administrator can disable enforcement under Hospital settings → Security, or enroll 2FA from an existing session.`,
      );
    }

    const twoFactorToken = await this.jwtService.signAsync(
      { typ: '2fa_pending', sub: user.id, email: user.email, role: user.role },
      {
        secret: this.config.get<string>('JWT_SECRET'),
        expiresIn: '5m',
      },
    );
    return {
      requiresTwoFactor: true,
      twoFactorToken,
      expiresIn: 300,
      user: this.toPublicUser(user),
    };
  }

  async refresh(user: User) {
    const tokens = await this.generateTokens(user);
    await this.usersService.updateRefreshToken(user.id, tokens.refreshToken);
    return tokens;
  }

  async logout(userId: string) {
    await this.usersService.updateRefreshToken(userId, null);
    return { message: 'Logged out successfully' };
  }

  toPublicUser(user: User) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl ?? null,
      preferredLocale: user.preferredLocale ?? 'en',
      preferredTheme: user.preferredTheme ?? 'system',
      totpEnabled: Boolean(user.totpEnabled),
    };
  }

  async me(userId: string) {
    const user = await this.usersService.findById(userId);
    return {
      ...this.toPublicUser(user),
      securityPolicy: await this.buildSecurityPolicyForUser(user),
    };
  }

  async updateMe(userId: string, dto: UpdateMeDto) {
    const user = await this.usersService.updateProfile(userId, {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.email !== undefined ? { email: dto.email } : {}),
      ...(dto.preferredLocale !== undefined ? { preferredLocale: dto.preferredLocale } : {}),
      ...(dto.preferredTheme !== undefined ? { preferredTheme: dto.preferredTheme } : {}),
    });
    return this.toPublicUser(user);
  }

  async deleteAccount(userId: string, dto: DeleteAccountDto) {
    const user = await this.usersService.findByIdWithPassword(userId);
    if (!user) throw new UnauthorizedException('Account not found');
    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('Password is incorrect');
    await this.usersService.deactivateAccount(userId);
    return { message: 'Your account has been deactivated. Contact your hospital to restore access.' };
  }

  /** When true (default), issued OTP is printed to the API process console — never returned in JSON. */
  private shouldLogOtpToConsole(): boolean {
    return this.config.get<string>('OTP_LOG_TO_CONSOLE', 'true') !== 'false';
  }

  private async enforceOtpRequestRate(email: string): Promise<void> {
    const allowed = await this.ephemeralStore.slidingWindowAllow(
      `otp:${email}`,
      OTP_WINDOW_MS,
      OTP_MAX_REQUESTS_PER_WINDOW,
    );
    if (!allowed) {
      throw new HttpException(
        'Too many OTP requests. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private otpDeliveryHint(): string {
    const smtp = Boolean(this.config.get('SMTP_HOST'));
    const twilio =
      Boolean(this.config.get('TWILIO_ACCOUNT_SID')) &&
      Boolean(this.config.get('TWILIO_AUTH_TOKEN')) &&
      Boolean(this.config.get('TWILIO_FROM_NUMBER'));
    if (smtp && twilio) {
      return 'If the account exists, check your email and SMS for the code.';
    }
    if (smtp) {
      return 'If the account exists, check your email for the code.';
    }
    if (twilio) {
      return 'If the account exists, check your SMS for the code.';
    }
    if (this.shouldLogOtpToConsole()) {
      return 'If the account exists, an OTP has been issued. Check the API server console for the code.';
    }
    return 'If the account exists, an OTP has been issued.';
  }

  async requestOtp(dto: RequestOtpDto) {
    const email = dto.email.trim().toLowerCase();
    await this.enforceOtpRequestRate(email);

    const user = await this.usersService.findByEmail(dto.email);
    const baseResponse = {
      message: this.otpDeliveryHint(),
      expiresInSeconds: OTP_TTL_MS / 1000,
    };

    if (!user || !user.isActive) {
      return baseResponse;
    }

    await this.otpRepo.delete({ email });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    await this.otpRepo.save(this.otpRepo.create({ email, code, expiresAt }));

    await this.otpDelivery.deliver({
      email,
      code,
      expiresInSeconds: OTP_TTL_MS / 1000,
      smsTo: dto.phone,
    });

    if (this.shouldLogOtpToConsole()) {
      this.logger.log(
        `[OTP] email=${email} code=${code} expiresInSeconds=${OTP_TTL_MS / 1000}`,
      );
    }

    return baseResponse;
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const email = dto.email.trim().toLowerCase();
    await this.assertValidOtp(email, dto.otpCode);
    await this.otpRepo.delete({ email });

    const user = await this.usersService.findByEmail(email);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const challenge = await this.maybeTwoFactorChallenge(user);
    if (challenge) return challenge;

    const tokens = await this.generateTokens(user);
    await this.usersService.updateRefreshToken(user.id, tokens.refreshToken);

    return {
      user: this.toPublicUser(user),
      securityPolicy: await this.buildSecurityPolicyForUser(user),
      ...tokens,
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const email = dto.email.trim().toLowerCase();
    await this.assertValidOtp(email, dto.otpCode);
    await this.otpRepo.delete({ email });

    const user = await this.usersService.findByEmail(email);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.usersService.updatePassword(user.id, dto.newPassword);
    return { message: 'Password updated. You can sign in with your new password.' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.usersService.findByIdWithPassword(userId);
    if (!user) throw new UnauthorizedException('Account not found');
    const valid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');

    await this.usersService.updatePassword(userId, dto.newPassword);
    return { message: 'Password updated successfully.' };
  }

  private async assertValidOtp(email: string, otpCode: string): Promise<void> {
    const row = await this.otpRepo.findOne({
      where: { email },
      order: { createdAt: 'DESC' },
    });

    if (!row || row.expiresAt.getTime() < Date.now()) {
      if (row) await this.otpRepo.delete({ id: row.id });
      throw new UnauthorizedException('OTP not requested or expired');
    }

    const expected = (row.code ?? '').trim();
    const given = (otpCode ?? '').trim();
    if (!expected || given !== expected) throw new UnauthorizedException('Invalid OTP');
  }

  private async generateTokens(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const sec = await this.getHospitalSecurityCached();
    const minutes = Math.max(5, Math.min(24 * 60, sec.sessionTimeoutMinutes || 30));
    const accessExpiresInSec = Math.floor(minutes * 60);
    // Refresh lifetime derived from session timeout (48× access, min 1 day, max 30 days).
    const refreshExpiresInSec = Math.min(
      30 * 24 * 60 * 60,
      Math.max(24 * 60 * 60, accessExpiresInSec * 48),
    );

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.config.get('JWT_SECRET'),
        expiresIn: accessExpiresInSec,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
        expiresIn: refreshExpiresInSec,
      }),
    ]);

    return { accessToken, refreshToken };
  }

  async verifyTwoFactorLogin(dto: { twoFactorToken: string; code: string }) {
    let payload: { typ?: string; sub?: string };
    try {
      payload = await this.jwtService.verifyAsync<{ typ?: string; sub?: string }>(dto.twoFactorToken, {
        secret: this.config.get<string>('JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired two-factor token');
    }
    if (payload.typ !== '2fa_pending' || !payload.sub) {
      throw new UnauthorizedException('Invalid two-factor token');
    }
    const user = await this.usersService.findByIdWithTotp(payload.sub);
    if (!user || !user.isActive || !user.totpEnabled || !user.totpSecret) {
      throw new UnauthorizedException('Two-factor authentication is not available for this account');
    }
    const ok = verifyTotpCode(user.totpSecret, dto.code);
    if (!ok) throw new UnauthorizedException('Invalid authenticator code');

    const tokens = await this.generateTokens(user);
    await this.usersService.updateRefreshToken(user.id, tokens.refreshToken);
    return {
      user: this.toPublicUser(user),
      securityPolicy: await this.buildSecurityPolicyForUser(user),
      ...tokens,
    };
  }

  async createTotpSetup(userId: string) {
    const user = await this.usersService.findById(userId);
    let issuer = 'HMS';
    try {
      const row = await this.hospitalSettingsRepo.findOne({ where: { id: 'singleton' } });
      const name = normalizeHospitalSettings(row?.settings ?? {}).general.hospitalName?.trim();
      if (name) issuer = name.slice(0, 40);
    } catch {
      /* ignore */
    }
    const secret = generateSecret();
    const otpauthUrl = generateURI({
      issuer,
      label: user.email,
      secret,
    });
    await this.ephemeralStore.setJson(`totp-setup:${userId}`, { secret }, TOTP_SETUP_TTL_MS);
    return { secret, otpauthUrl };
  }

  async enableTotp(userId: string, dto: { secret?: string; code: string }) {
    const pendingKey = `totp-setup:${userId}`;
    const pending = await this.ephemeralStore.getJson<{ secret: string }>(pendingKey);
    const secretFromClient = dto.secret?.trim() ? normalizeTotpSecret(dto.secret) : '';
    const secret = secretFromClient || pending?.secret;
    if (!secret) {
      throw new BadRequestException(
        'No authenticator setup in progress. Click “Set up authenticator” again, then enter the new code.',
      );
    }
    const ok = verifyTotpCode(secret, dto.code);
    if (!ok) {
      throw new BadRequestException(
        'Invalid authenticator code. Use the latest code from the app entry you just added, wait for a fresh code if needed, and ensure phone time is set automatically.',
      );
    }
    await this.ephemeralStore.delete(pendingKey);
    await this.usersService.updateTotp(userId, { totpSecret: secret, totpEnabled: true });
    return { totpEnabled: true };
  }

  async disableTotp(userId: string, password: string) {
    const user = await this.usersService.findByIdWithPassword(userId);
    if (!user) throw new UnauthorizedException('Account not found');
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new UnauthorizedException('Password is incorrect');
    await this.usersService.updateTotp(userId, { totpSecret: null, totpEnabled: false });
    return { totpEnabled: false };
  }
}
