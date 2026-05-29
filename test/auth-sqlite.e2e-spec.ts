import { Module, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import request from 'supertest';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { AuthModule } from '../src/modules/auth/auth.module';
import { UsersModule } from '../src/modules/users/users.module';
import { User } from '../src/modules/users/entities/user.entity';
import { OtpCode } from '../src/modules/auth/entities/otp-code.entity';
import { Role } from '../src/common/enums/roles.enum';
import {
  OtpDeliveryService,
  OtpDeliveryPayload,
} from '../src/modules/auth/otp-delivery.service';

/** Minimal app: SQLite + auth/users only — runs without Postgres. */

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: ':memory:',
      entities: [User, OtpCode],
      synchronize: true,
    }),
    UsersModule,
    AuthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
class AuthSqliteE2eModule {}

describe('Auth (e2e, sqlite)', () => {
  let app!: INestApplication;
  const delivered: OtpDeliveryPayload[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AuthSqliteE2eModule],
    })
      .overrideProvider(OtpDeliveryService)
      .useValue({
        deliver: async (p: OtpDeliveryPayload) => {
          delivered.push(p);
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();

    const ds = app.get(DataSource);
    const userRepo = ds.getRepository(User);
    await userRepo.save({
      name: 'E2E User',
      email: 'e2e@hms.com',
      password: await bcrypt.hash('E2E_Password1', 8),
      role: Role.PATIENT,
      isActive: true,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    delivered.length = 0;
  });

  it('POST /auth/login rejects bad password', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'e2e@hms.com', password: 'wrongpw' })
      .expect(401);
  });

  it('POST /auth/login returns tokens', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'e2e@hms.com', password: 'E2E_Password1' })
      .expect(201);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.user?.email).toBe('e2e@hms.com');
  });

  it('POST /auth/request-otp then verify-otp succeeds', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/request-otp')
      .send({ email: 'e2e@hms.com' })
      .expect(201);

    expect(delivered).toHaveLength(1);
    const code = delivered[0].code;

    await request(app.getHttpServer())
      .post('/api/v1/auth/verify-otp')
      .send({ email: 'e2e@hms.com', otpCode: code })
      .expect(201);
  });

  it('POST /auth/request-otp rejects invalid phone format', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/request-otp')
      .send({ email: 'e2e@hms.com', phone: '5551234567' })
      .expect(400);
  });
});
