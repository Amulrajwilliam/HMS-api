import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { mkdir, writeFile, unlink } from 'fs/promises';
import { createReadStream } from 'fs';
import { join, basename } from 'path';
import { Readable } from 'stream';
import { ReportStorageProvider } from './entities/medical-report.entity';

@Injectable()
export class ReportStorageService {
  private readonly logger = new Logger(ReportStorageService.name);
  private s3: S3Client | null = null;

  constructor(private readonly config: ConfigService) {
    const region = this.config.get<string>('AWS_REGION');
    const key = this.config.get<string>('AWS_ACCESS_KEY_ID');
    const secret = this.config.get<string>('AWS_SECRET_ACCESS_KEY');
    if (region && key && secret) {
      this.s3 = new S3Client({ region, credentials: { accessKeyId: key, secretAccessKey: secret } });
    }
  }

  private reportsLocalBase(): string {
    return this.config.get<string>('REPORTS_LOCAL_DIR') || join(process.cwd(), 'uploads', 'reports');
  }

  s3Configured(): boolean {
    return Boolean(this.s3 && this.config.get<string>('AWS_S3_BUCKET'));
  }

  async persistUpload(params: {
    reportId: string;
    buffer: Buffer;
    originalFilename: string;
    mimeType: string;
  }): Promise<{ provider: ReportStorageProvider; storageKey: string; s3Bucket?: string; fileSize: number }> {
    const safe =
      basename(params.originalFilename).replace(/[^a-zA-Z0-9._-]/g, '_') || 'upload.bin';
    const fileSize = params.buffer.length;

    if (this.s3Configured()) {
      const bucket = this.config.get<string>('AWS_S3_BUCKET')!;
      const storageKey = `reports/${params.reportId}/${safe}`;
      await this.s3!.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: storageKey,
          Body: params.buffer,
          ContentType: params.mimeType || 'application/octet-stream',
        }),
      );
      this.logger.log(`Report stored in S3: ${storageKey}`);
      return { provider: ReportStorageProvider.S3, storageKey, s3Bucket: bucket, fileSize };
    }

    const base = this.reportsLocalBase();
    const dir = join(base, params.reportId);
    await mkdir(dir, { recursive: true });
    const fullPath = join(dir, safe);
    await writeFile(fullPath, params.buffer);
    const storageKey = `${params.reportId}/${safe}`;
    this.logger.log(`Report stored locally: ${storageKey}`);
    return { provider: ReportStorageProvider.LOCAL, storageKey, fileSize };
  }

  async openReadStream(storageKey: string, provider: ReportStorageProvider, bucket?: string): Promise<Readable> {
    if (provider === ReportStorageProvider.LOCAL) {
      const full = join(this.reportsLocalBase(), storageKey);
      return createReadStream(full);
    }
    if (!this.s3 || !bucket) throw new Error('S3 not configured');
    const out = await this.s3.send(new GetObjectCommand({ Bucket: bucket, Key: storageKey }));
    if (!out.Body) throw new Error('Empty S3 body');
    return out.Body as Readable;
  }

  async presignedGetUrl(storageKey: string, bucket: string, expiresIn = 300): Promise<string> {
    if (!this.s3) throw new Error('S3 not configured');
    return getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: bucket, Key: storageKey }),
      { expiresIn },
    );
  }

  async deleteObject(provider: ReportStorageProvider, storageKey: string, bucket?: string): Promise<void> {
    if (provider === ReportStorageProvider.LOCAL) {
      const full = join(this.reportsLocalBase(), storageKey);
      try {
        await unlink(full);
      } catch {
        /* ignore missing file */
      }
      return;
    }
    if (this.s3 && bucket) {
      await this.s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: storageKey }));
    }
  }
}
