import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { Role } from '../../common/enums/roles.enum';
import { PasswordPolicyService } from '../../common/services/password-policy.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private repo: Repository<User>,
    private passwordPolicy: PasswordPolicyService,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    const exists = await this.repo.findOne({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email already registered');
    await this.passwordPolicy.assertValid(dto.password);
    const hashed = await bcrypt.hash(dto.password, 12);
    const user = this.repo.create({ ...dto, password: hashed });
    return this.repo.save(user);
  }

  async findAll(): Promise<User[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async findById(id: string): Promise<User> {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async findByIdWithPassword(id: string): Promise<User | null> {
    return this.repo
      .createQueryBuilder('user')
      .where('user.id = :id', { id })
      .addSelect('user.password')
      .getOne();
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.repo.findOne({
      where: { email },
      select: [
        'id',
        'name',
        'email',
        'password',
        'role',
        'isActive',
        'refreshToken',
        'avatarUrl',
        'preferredLocale',
        'preferredTheme',
        'totpEnabled',
      ],
    });
  }

  async findByEmailNormalized(email: string): Promise<User | null> {
    return this.findByEmail(email.trim().toLowerCase());
  }

  async updateRefreshToken(id: string, token: string | null): Promise<void> {
    const hashed = token ? await bcrypt.hash(token, 10) : undefined;
    await this.repo.update(id, { refreshToken: hashed, lastLogin: new Date() });
  }

  async updatePassword(id: string, plainPassword: string): Promise<void> {
    await this.passwordPolicy.assertValid(plainPassword);
    const hashed = await bcrypt.hash(plainPassword, 12);
    await this.repo.update(id, { password: hashed, refreshToken: undefined });
  }

  async updateProfile(
    id: string,
    patch: Partial<Pick<User, 'name' | 'email' | 'avatarUrl' | 'preferredLocale' | 'preferredTheme'>>,
  ): Promise<User> {
    if (patch.email) {
      const normalized = patch.email.trim().toLowerCase();
      const existing = await this.repo.findOne({ where: { email: normalized } });
      if (existing && existing.id !== id) {
        throw new ConflictException('Email is already in use');
      }
      patch = { ...patch, email: normalized };
    }
    await this.repo.update(id, patch);
    return this.findById(id);
  }

  async deactivateAccount(id: string): Promise<void> {
    await this.repo.update(id, {
      isActive: false,
      refreshToken: undefined,
    });
  }

  async updateRole(id: string, role: Role): Promise<User> {
    await this.repo.update(id, { role });
    return this.findById(id);
  }

  async toggleActive(id: string): Promise<User> {
    const user = await this.findById(id);
    await this.repo.update(id, { isActive: !user.isActive });
    return this.findById(id);
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.repo.softDelete(id);
  }

  async count(): Promise<number> {
    return this.repo.count();
  }

  /** Login: includes password + totpSecret (select:false). */
  async findByEmailWithCredentials(email: string): Promise<User | null> {
    const e = email.trim().toLowerCase();
    return this.repo
      .createQueryBuilder('u')
      .where('LOWER(TRIM(u.email)) = :e', { e })
      .addSelect(['u.password', 'u.totpSecret'])
      .getOne();
  }

  async findByIdWithTotp(id: string): Promise<User | null> {
    return this.repo
      .createQueryBuilder('u')
      .where('u.id = :id', { id })
      .addSelect('u.totpSecret')
      .getOne();
  }

  async updateTotp(userId: string, patch: { totpSecret?: string | null; totpEnabled?: boolean }): Promise<void> {
    await this.repo.update(userId, patch);
  }
}
