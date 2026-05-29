import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface OtpDeliveryPayload {
  email: string;
  code: string;
  expiresInSeconds: number;
  /** E.164 phone for Twilio SMS (optional). */
  smsTo?: string;
}

@Injectable()
export class OtpDeliveryService {
  private readonly logger = new Logger(OtpDeliveryService.name);
  private mailer: Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

  private smtpConfigured(): boolean {
    return Boolean(this.config.get('SMTP_HOST'));
  }

  private twilioConfigured(): boolean {
    return Boolean(
      this.config.get('TWILIO_ACCOUNT_SID') &&
        this.config.get('TWILIO_AUTH_TOKEN') &&
        this.config.get('TWILIO_FROM_NUMBER'),
    );
  }

  private getMailer(): Transporter | null {
    if (!this.smtpConfigured()) return null;
    if (this.mailer) return this.mailer;
    const host = this.config.get<string>('SMTP_HOST');
    const port = this.config.get<number>('SMTP_PORT', 587);
    const secure = this.config.get<string>('SMTP_SECURE') === 'true';
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    this.mailer = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
    });
    return this.mailer;
  }

  async deliver(payload: OtpDeliveryPayload): Promise<void> {
    const errors: string[] = [];

    if (this.smtpConfigured()) {
      try {
        await this.sendEmail(payload);
      } catch (e) {
        errors.push(`email: ${(e as Error).message}`);
      }
    }

    if (this.twilioConfigured() && payload.smsTo) {
      try {
        await this.sendTwilioSms(payload.smsTo, payload);
      } catch (e) {
        errors.push(`sms: ${(e as Error).message}`);
      }
    }

    if (errors.length) {
      this.logger.warn(`OTP channel failures: ${errors.join('; ')}`);
    }
  }

  private async sendEmail(payload: OtpDeliveryPayload): Promise<void> {
    const transport = this.getMailer();
    if (!transport) return;

    const from =
      this.config.get<string>('SMTP_FROM') ||
      this.config.get<string>('SMTP_USER') ||
      'no-reply@hms.local';

    const subject =
      this.config.get<string>('OTP_EMAIL_SUBJECT') || 'Your HMS login code';

    const text = `Your verification code is: ${payload.code}\n\nIt expires in ${payload.expiresInSeconds} seconds.`;

    await transport.sendMail({
      from,
      to: payload.email,
      subject,
      text,
    });
    this.logger.log(`OTP email sent to ${payload.email}`);
  }

  private async sendTwilioSms(to: string, payload: OtpDeliveryPayload): Promise<void> {
    const sid = this.config.get<string>('TWILIO_ACCOUNT_SID')!;
    const token = this.config.get<string>('TWILIO_AUTH_TOKEN')!;
    const from = this.config.get<string>('TWILIO_FROM_NUMBER')!;
    const body = `Your HMS code is ${payload.code}. Expires in ${payload.expiresInSeconds}s.`;

    const auth = Buffer.from(`${sid}:${token}`).toString('base64');
    const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ From: from, To: to, Body: body }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Twilio ${res.status}: ${errText}`);
    }
    this.logger.log(`OTP SMS sent to ${to}`);
  }
}
