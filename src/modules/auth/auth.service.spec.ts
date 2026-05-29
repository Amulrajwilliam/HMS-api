import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, HttpException, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { OtpCode } from './entities/otp-code.entity';
import { Role } from '../../common/enums/roles.enum';
import { OtpDeliveryService } from './otp-delivery.service';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: { findByEmail: jest.Mock };
  let otpRepo: {
    delete: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
  };

  beforeEach(async () => {
    usersService = { findByEmail: jest.fn() };
    otpRepo = {
      delete: jest.fn().mockResolvedValue(undefined),
      save: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn(),
      create: jest.fn((x) => x),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        {
          provide: JwtService,
          useValue: { signAsync: jest.fn().mockResolvedValue('token') },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, def?: string) => {
              if (key === 'NODE_ENV') return 'test';
              if (key === 'JWT_SECRET') return 's';
              if (key === 'JWT_EXPIRES_IN') return '15m';
              if (key === 'JWT_REFRESH_SECRET') return 'r';
              if (key === 'JWT_REFRESH_EXPIRES_IN') return '7d';
              return def;
            }),
          },
        },
        {
          provide: getRepositoryToken(OtpCode),
          useValue: otpRepo,
        },
        {
          provide: OtpDeliveryService,
          useValue: { deliver: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('requestOtp returns generic message when user missing', async () => {
    usersService.findByEmail.mockResolvedValue(null);
    const res = await service.requestOtp({ email: 'nobody@example.com' });
    expect(res.message).toContain('If the account exists');
    expect(otpRepo.save).not.toHaveBeenCalled();
  });

  it('requestOtp persists OTP when user active', async () => {
    usersService.findByEmail.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      role: Role.PATIENT,
      isActive: true,
    });
    const res = await service.requestOtp({ email: 'a@b.com' });
    expect(otpRepo.delete).toHaveBeenCalledWith({ email: 'a@b.com' });
    expect(otpRepo.create).toHaveBeenCalled();
    const created = otpRepo.create.mock.calls[0][0] as { code?: string };
    expect(created.code).toMatch(/^\d{6}$/);
    expect(otpRepo.save).toHaveBeenCalled();
    expect(res).not.toHaveProperty('otpCode');
    expect((res as { message?: string }).message).toContain('console');
  });

  it('verifyOtp rejects when no OTP row', async () => {
    otpRepo.findOne.mockResolvedValue(null);
    await expect(
      service.verifyOtp({ email: 'a@b.com', otpCode: '123456' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws TooManyRequests after burst of requestOtp', async () => {
    usersService.findByEmail.mockResolvedValue(null);
    for (let i = 0; i < 5; i++) {
      await service.requestOtp({ email: 'spam@example.com' });
    }
    let thrown: unknown;
    try {
      await service.requestOtp({ email: 'spam@example.com' });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
  });
});
