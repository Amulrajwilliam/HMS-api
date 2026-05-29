import { Injectable, Logger, NotFoundException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationModule, NotificationType } from './entities/notification.entity';
import { NotificationTemplate } from './entities/notification-template.entity';
import { UserPushDevice } from './entities/user-push-device.entity';
import { DispatchNotificationDto, RegisterPushTokenDto, UpsertNotificationTemplateDto } from './dto/notifications.dto';
import * as nodemailer from 'nodemailer';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private firebaseApp: any | null = null;

  constructor(
    @InjectRepository(Notification) private repo: Repository<Notification>,
    @InjectRepository(NotificationTemplate) private templateRepo: Repository<NotificationTemplate>,
    @InjectRepository(UserPushDevice) private pushDeviceRepo: Repository<UserPushDevice>,
    private readonly cfg: ConfigService,
  ) {}

  async create(data: {
    userId?: string; title: string; message: string;
    type?: NotificationType; module?: NotificationModule;
    actionUrl?: string; relatedId?: string;
  }): Promise<Notification> {
    const notif = this.repo.create({
      user: data.userId ? { id: data.userId } as any : undefined,
      title: data.title, message: data.message,
      type: data.type ?? NotificationType.INFO,
      module: data.module ?? NotificationModule.SYSTEM,
      actionUrl: data.actionUrl, relatedId: data.relatedId,
    });
    const saved = await this.repo.save(notif);
    if (data.userId) {
      void this.pushToUser(data.userId, saved).catch((e) => {
        this.logger.warn(`push after create failed: ${(e as Error).message}`);
      });
    }
    return saved;
  }

  async registerPushToken(userId: string, dto: RegisterPushTokenDto) {
    const provider = dto.provider ?? (dto.pushToken.startsWith('ExponentPushToken') ? 'expo' : 'fcm');
    const existing = await this.pushDeviceRepo.findOne({
      where: { userId, pushToken: dto.pushToken },
    });
    if (existing) {
      existing.deviceId = dto.deviceId ?? existing.deviceId;
      existing.platform = dto.platform ?? existing.platform;
      existing.provider = provider;
      return this.pushDeviceRepo.save(existing);
    }
    return this.pushDeviceRepo.save(
      this.pushDeviceRepo.create({
        userId,
        pushToken: dto.pushToken,
        deviceId: dto.deviceId ?? null,
        platform: dto.platform ?? null,
        provider,
      }),
    );
  }

  async getPushTokensForUser(userId: string): Promise<string[]> {
    const rows = await this.pushDeviceRepo.find({ where: { userId }, select: ['pushToken'] });
    return rows.map((r) => r.pushToken);
  }

  async findForUser(userId: string, page = 1, limit = 20) {
    const qb = this.repo.createQueryBuilder('n')
      .where('n.user IS NULL OR n.user.id = :userId', { userId })
      .orderBy('n.createdAt', 'DESC')
      .skip((page - 1) * limit).take(limit);
    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, pages: Math.ceil(total / limit) };
  }

  async findOneForUser(id: string, userId: string): Promise<Notification> {
    const n = await this.repo.findOne({ where: { id }, relations: ['user'] });
    if (!n) throw new NotFoundException(`Notification ${id} not found`);
    if (n.user && n.user.id !== userId) {
      throw new ForbiddenException('You do not have access to this notification');
    }
    return n;
  }

  async markRead(id: string, userId: string): Promise<void> {
    await this.findOneForUser(id, userId);
    await this.repo.update({ id }, { isRead: true });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.repo.update({ user: { id: userId }, isRead: false }, { isRead: true });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.repo.createQueryBuilder('n')
      .where('(n.user IS NULL OR n.user.id = :userId) AND n.isRead = false', { userId })
      .getCount();
  }

  async listTemplates() {
    return this.templateRepo.find({ order: { key: 'ASC' } });
  }

  async upsertTemplate(input: UpsertNotificationTemplateDto) {
    const existing = await this.templateRepo.findOne({ where: { key: input.key } });
    const merged = this.templateRepo.create({
      ...existing,
      ...input,
      defaultType: input.defaultType ?? existing?.defaultType ?? NotificationType.INFO,
      defaultModule: input.defaultModule ?? existing?.defaultModule ?? NotificationModule.SYSTEM,
    });
    return this.templateRepo.save(merged);
  }

  async dispatch(payload: DispatchNotificationDto) {
    const rendered = await this.resolveContent(payload);
    const results: Record<string, unknown> = {};

    if (payload.sendInApp ?? true) {
      results.inApp = await this.create({
        userId: payload.userId,
        title: rendered.title,
        message: rendered.message,
        type: rendered.type,
        module: rendered.module,
        actionUrl: payload.actionUrl,
        relatedId: payload.relatedId,
      });
    }
    if (payload.sendEmail) {
      results.email = await this.sendEmail(payload.emailTo, rendered.title, rendered.message);
    }
    if (payload.sendSms) {
      results.sms = await this.sendSms(payload.smsTo, rendered.message);
    }
    if (payload.sendPush) {
      const tokens =
        payload.pushTokens?.length && payload.userId
          ? payload.pushTokens
          : payload.userId
            ? await this.getPushTokensForUser(payload.userId)
            : payload.pushTokens;
      const data = this.pushDataPayload({
        notificationId: (results.inApp as Notification | undefined)?.id,
        title: rendered.title,
        message: rendered.message,
        type: rendered.type,
        module: rendered.module,
        actionUrl: payload.actionUrl,
        relatedId: payload.relatedId,
      });
      results.push = await this.sendPush(tokens, rendered.title, rendered.message, data);
    }

    return { ok: true, channels: results };
  }

  private pushDataPayload(fields: {
    notificationId?: string;
    title: string;
    message: string;
    type: NotificationType;
    module: NotificationModule;
    actionUrl?: string;
    relatedId?: string;
  }): Record<string, string> {
    return {
      notificationId: fields.notificationId ?? '',
      title: fields.title,
      message: fields.message,
      type: fields.type,
      module: fields.module,
      actionUrl: fields.actionUrl ?? '',
      relatedId: fields.relatedId ?? '',
    };
  }

  private async pushToUser(userId: string, notif: Notification) {
    const tokens = await this.getPushTokensForUser(userId);
    if (!tokens.length) return { skipped: true, reason: 'no registered devices' };
    return this.sendPush(
      tokens,
      notif.title,
      notif.message,
      this.pushDataPayload({
        notificationId: notif.id,
        title: notif.title,
        message: notif.message,
        type: notif.type,
        module: notif.module,
        actionUrl: notif.actionUrl ?? undefined,
        relatedId: notif.relatedId ?? undefined,
      }),
    );
  }

  private async resolveContent(payload: DispatchNotificationDto) {
    let title = payload.title ?? '';
    let message = payload.message ?? '';
    let type = payload.type ?? NotificationType.INFO;
    let module = payload.module ?? NotificationModule.SYSTEM;

    if (payload.templateKey) {
      const tpl = await this.templateRepo.findOne({ where: { key: payload.templateKey } });
      if (!tpl) throw new NotFoundException(`notification template ${payload.templateKey} not found`);
      title = this.renderTemplate(tpl.titleTemplate, payload.context);
      message = this.renderTemplate(tpl.messageTemplate, payload.context);
      type = payload.type ?? tpl.defaultType;
      module = payload.module ?? tpl.defaultModule;
    }

    if (!title || !message) {
      throw new ServiceUnavailableException('notification title/message are required');
    }
    return { title, message, type, module };
  }

  private renderTemplate(template: string, context?: Record<string, unknown>) {
    if (!context) return template;
    return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_, key: string) => {
      const value = context[key];
      return value == null ? '' : String(value);
    });
  }

  private async sendEmail(to: string | undefined, subject: string, text: string) {
    if (!to) throw new ServiceUnavailableException('email recipient is required');
    const host = this.cfg.get<string>('SMTP_HOST');
    if (!host) return { skipped: true, reason: 'SMTP_HOST not configured' };

    const transport = nodemailer.createTransport({
      host,
      port: this.cfg.get<number>('SMTP_PORT', 587),
      secure: this.cfg.get<string>('SMTP_SECURE') === 'true',
      auth: this.cfg.get<string>('SMTP_USER')
        ? {
            user: this.cfg.get<string>('SMTP_USER'),
            pass: this.cfg.get<string>('SMTP_PASS'),
          }
        : undefined,
    });
    const info = await transport.sendMail({
      from: this.cfg.get<string>('SMTP_FROM', 'no-reply@hms.local'),
      to,
      subject,
      text,
    });
    return { accepted: info.accepted.length, rejected: info.rejected.length };
  }

  private async sendSms(to: string | undefined, message: string) {
    if (!to) throw new ServiceUnavailableException('sms recipient is required');
    const url = this.cfg.get<string>('SMS_PROVIDER_URL');
    if (!url) return { skipped: true, reason: 'SMS_PROVIDER_URL not configured' };

    const apiKey = this.cfg.get<string>('SMS_PROVIDER_API_KEY');
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({ to, message }),
    });
    if (!res.ok) throw new ServiceUnavailableException(`SMS provider HTTP ${res.status}`);
    return { ok: true };
  }

  private async sendPush(
    tokens: string[] | undefined,
    title: string,
    body: string,
    data?: Record<string, string>,
  ) {
    if (!tokens?.length) throw new ServiceUnavailableException('pushTokens are required');

    const payload = { source: 'hms', ...data };
    const expoTokens = tokens.filter((t) => t.startsWith('ExponentPushToken[') || t.startsWith('ExpoPushToken'));
    const nativeTokens = tokens.filter((t) => !expoTokens.includes(t));

    const results: Record<string, unknown> = {};
    if (expoTokens.length) {
      results.expo = await this.sendExpoPush(expoTokens, title, body, payload);
    }
    if (nativeTokens.length) {
      const app = await this.ensureFirebaseApp();
      if (!app) {
        results.fcm = { skipped: true, reason: 'Firebase not configured' };
      } else {
        const res = await app.messaging().sendEachForMulticast({
          tokens: nativeTokens,
          notification: { title, body },
          data: payload,
        });
        results.fcm = { successCount: res.successCount, failureCount: res.failureCount };
      }
    }
    return results;
  }

  private async sendExpoPush(
    tokens: string[],
    title: string,
    body: string,
    data: Record<string, string>,
  ) {
    const messages = tokens.map((to) => ({
      to,
      title,
      body,
      data,
      sound: 'default',
    }));
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(messages),
    });
    if (!res.ok) {
      throw new ServiceUnavailableException(`Expo push HTTP ${res.status}`);
    }
    const json = (await res.json()) as { data?: Array<{ status?: string }> };
    const ok = json.data?.filter((r) => r.status === 'ok').length ?? 0;
    return { successCount: ok, failureCount: tokens.length - ok };
  }

  private async ensureFirebaseApp() {
    if (this.firebaseApp) return this.firebaseApp;
    const rawCreds = this.cfg.get<string>('FIREBASE_SERVICE_ACCOUNT_JSON');
    if (!rawCreds) return null;

    const admin = await import('firebase-admin');
    const parsed = JSON.parse(rawCreds);
    this.firebaseApp = admin.apps.length
      ? admin.app()
      : admin.initializeApp({
          credential: admin.credential.cert(parsed),
          projectId: this.cfg.get<string>('FIREBASE_PROJECT_ID') || parsed.project_id,
        });
    this.logger.log('Firebase Admin initialized for push notifications');
    return this.firebaseApp;
  }
}
