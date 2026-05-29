import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { AppModule } from '../src/app.module';
import { seedDatabase } from '../src/database/seed';

/**
 * Full Phase 1 API checks against Postgres (RBAC, patients, billing).
 * Requires a running DB matching `apps/api/.env` and demo seed data.
 *
 *   set E2E_USE_POSTGRES=true
 *   npm run test:e2e --workspace=apps/api
 */
const runPostgresE2e = process.env.E2E_USE_POSTGRES === 'true';
const pgDescribe = runPostgresE2e ? describe : describe.skip;

const DEMO_PASSWORD = 'Demo@1234';

async function login(
  app: INestApplication,
  email: string,
  password = DEMO_PASSWORD,
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email, password })
    .expect(201);
  return res.body.accessToken as string;
}

pgDescribe('Phase 1 API (e2e, postgres)', () => {
  let app!: INestApplication;

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
  }, 60000);

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1 is public (health)', () => {
    return request(app.getHttpServer()).get('/api/v1').expect(200);
  });

  it('GET /patients without token returns 401', () => {
    return request(app.getHttpServer()).get('/api/v1/patients').expect(401);
  });

  it('patient role cannot list patients (403)', async () => {
    const token = await login(app, 'patient@hms.com');
    await request(app.getHttpServer())
      .get('/api/v1/patients')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('receptionist can list patients', async () => {
    const token = await login(app, 'receptionist@hms.com');
    const res = await request(app.getHttpServer())
      .get('/api/v1/patients')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('patient cannot list users (403)', async () => {
    const token = await login(app, 'patient@hms.com');
    await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('billing: create invoice + patient sees my-invoices', async () => {
    const recToken = await login(app, 'receptionist@hms.com');
    const list = await request(app.getHttpServer())
      .get('/api/v1/patients')
      .set('Authorization', `Bearer ${recToken}`)
      .expect(200);

    const portalPatient = (list.body.data as { id: string; email?: string }[]).find(
      (p) => p.email === 'patient@hms.com',
    );
    expect(portalPatient).toBeDefined();

    const createInv = await request(app.getHttpServer())
      .post('/api/v1/billing/invoices')
      .set('Authorization', `Bearer ${recToken}`)
      .send({
        patientId: portalPatient!.id,
        items: [{ description: 'E2E consult', quantity: 1, unitPrice: 500 }],
      })
      .expect(201);

    const invoiceId = createInv.body.id as string;
    expect(invoiceId).toBeDefined();

    const patientToken = await login(app, 'patient@hms.com');
    const mine = await request(app.getHttpServer())
      .get('/api/v1/billing/my-invoices')
      .set('Authorization', `Bearer ${patientToken}`)
      .expect(200);

    const ids = (mine.body.data as { id: string }[]).map((i) => i.id);
    expect(ids).toContain(invoiceId);

    await request(app.getHttpServer())
      .get(`/api/v1/billing/invoices/${invoiceId}`)
      .set('Authorization', `Bearer ${patientToken}`)
      .expect(200);
  });
});
