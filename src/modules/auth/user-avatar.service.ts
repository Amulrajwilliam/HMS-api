import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createReadStream } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';

const AVATAR_DIR = path.join(process.cwd(), 'uploads', 'avatars');
const AVATAR_MIMES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);

@Injectable()
export class UserAvatarService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  async upload(userId: string, file: Express.Multer.File | undefined, apiPublicPrefix: string): Promise<User> {
    if (!file?.buffer?.length) throw new BadRequestException('File is required');
    const mime = (file.mimetype || '').toLowerCase();
    if (!AVATAR_MIMES.has(mime)) {
      throw new BadRequestException(`Unsupported image type: ${mime || 'unknown'}`);
    }
    if (file.size > 3 * 1024 * 1024) throw new BadRequestException('Image too large (max 3MB)');

    const ext =
      mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
    const fileName = `${userId}-${randomUUID()}.${ext}`;
    await mkdir(AVATAR_DIR, { recursive: true });
    await writeFile(path.join(AVATAR_DIR, fileName), file.buffer);

    const base = apiPublicPrefix.replace(/\/$/, '');
    const avatarUrl = `${base}/auth/avatars/${fileName}`;
    await this.users.update(userId, { avatarUrl });
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  readAsset(fileName: string): { stream: ReturnType<typeof createReadStream>; contentType: string } {
    const safe = path.basename(fileName);
    if (!safe || safe !== fileName || !/^[\w.-]+\.(png|jpe?g|webp)$/i.test(safe)) {
      throw new NotFoundException('Avatar not found');
    }
    const full = path.join(AVATAR_DIR, safe);
    const ext = path.extname(safe).toLowerCase();
    const contentType =
      ext === '.png'
        ? 'image/png'
        : ext === '.webp'
          ? 'image/webp'
          : 'image/jpeg';
    return { stream: createReadStream(full), contentType };
  }
}
