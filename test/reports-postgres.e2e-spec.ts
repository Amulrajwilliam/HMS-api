import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { AppModule } from '../src/app.module';
import { seedDatabase } from '../src/database/seed';
import { User } from '../src/modules/users/entities/user.entity';
import { Role } from '../src/common/enums/roles.enum';

const runPostgresE2e = process.env.E2E_USE_POSTGRES === 'true';
const pgDescribe = runPostgresE2e ? describe : describe.skip;

async function login(app: INestApplication, email: string, password: string): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email, password })
    .expect(201);
  return res.body.accessToken as string;
}

pgDescribe('Reports API (e2e, postgres)', () => {
  let app!: INestApplication;
  const docEmail = 'reports-doctor@hms.com';
  const docPass = 'Reports@123';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

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
    await seedDatabase(ds);

    const userRepo = ds.getRepository(User);
    const existing = await userRepo.findOne({ where: { email: docEmail } });
    const hashed = await bcrypt.hash(docPass, 8);
    if (!existing) {
      await userRepo.save(
        userRepo.create({
          name: 'Reports Doctor',
          email: docEmail,
          password: hashed,
          role: Role.DOCTOR,
          isActive: true,
        }),
      );
    } else {
      await userRepo.update({ id: existing.id }, { password: hashed, role: Role.DOCTOR, isActive: true });
    }
  }, 60000);

  afterAll(async () => {
    await app.close();
  });

  it('doctor can upload/list/download report', async () => {
    const token = await login(app, docEmail, docPass);
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF\n', 'utf-8');

    const up = await request(app.getHttpServer())
      .post('/api/v1/reports/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'PG E2E report')
      .field('reportType', 'lab_pdf')
      .attach('file', pdf, { filename: 'pg.pdf', contentType: 'application/pdf' })
      .expect(201);

    const list = await request(app.getHttpServer())
      .get('/api/v1/reports')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(list.body.data.some((r: { id: string }) => r.id === up.body.id)).toBe(true);

    await request(app.getHttpServer())
      .get(`/api/v1/reports/${up.body.id}/download`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });
});

