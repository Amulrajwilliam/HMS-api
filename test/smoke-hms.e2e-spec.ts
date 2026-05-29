import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { seedDatabase } from '../src/database/seed';

/**
 * Full HMS API smoke suite (Postgres + demo seed).
 *
 *   set E2E_USE_POSTGRES=true
 *   npm run smoke:api
 *
 * Or from repo root: npm run smoke:api
 */
const runPostgresE2e = process.env.E2E_USE_POSTGRES === 'true';
const smokeDescribe = runPostgresE2e ? describe : describe.skip;

const DEMO_PASSWORD = process.env.SMOKE_PASSWORD || 'Demo@1234';

type Tokens = Record<string, string>;

async function login(
  app: INestApplication,
  email: string,
  password = DEMO_PASSWORD,
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email, password })
    .expect(201);
  expect(res.body.accessToken).toBeTruthy();
  return res.body.accessToken as string;
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

smokeDescribe('HMS smoke (e2e, postgres)', () => {
  let app!: INestApplication;
  const tokens: Tokens = {};
  let samplePatientId = '';
  let sampleWardId = '';

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

    const roles = [
      'admin@hms.com',
      'doctor@hms.com',
      'nurse@hms.com',
      'billing@hms.com',
      'lab@hms.com',
      'receptionist@hms.com',
      'patient@hms.com',
    ];
    for (const email of roles) {
      tokens[email] = await login(app, email);
    }

    const patients = await request(app.getHttpServer())
      .get('/api/v1/patients')
      .set(auth(tokens['receptionist@hms.com']))
      .expect(200);
    samplePatientId = patients.body.data?.[0]?.id;
    expect(samplePatientId).toBeTruthy();

    const wards = await request(app.getHttpServer())
      .get('/api/v1/adt/wards')
      .set(auth(tokens['nurse@hms.com']))
      .expect(200);
    sampleWardId = Array.isArray(wards.body) ? wards.body[0]?.id : wards.body?.[0]?.id;
  }, 120000);

  afterAll(async () => {
    await app?.close();
  });

  describe('Health & auth', () => {
    it('GET /api/v1 is public', () => {
      return request(app.getHttpServer()).get('/api/v1').expect(200);
    });

    it('GET /auth/me for each demo role', async () => {
      for (const email of Object.keys(tokens)) {
        const res = await request(app.getHttpServer())
          .get('/api/v1/auth/me')
          .set(auth(tokens[email]))
          .expect(200);
        expect(res.body.email).toBe(email);
      }
    });

    it('patient cannot list all patients (403)', () => {
      return request(app.getHttpServer())
        .get('/api/v1/patients')
        .set(auth(tokens['patient@hms.com']))
        .expect(403);
    });
  });

  describe('Patients & appointments', () => {
    it('receptionist lists patients', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/patients')
        .set(auth(tokens['receptionist@hms.com']))
        .expect(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('patient GET /patients/me/profile', () => {
      return request(app.getHttpServer())
        .get('/api/v1/patients/me/profile')
        .set(auth(tokens['patient@hms.com']))
        .expect(200);
    });

    it('patient lists own appointments', () => {
      return request(app.getHttpServer())
        .get('/api/v1/appointments/mine')
        .set(auth(tokens['patient@hms.com']))
        .expect(200);
    });

    it('doctor lists appointments', () => {
      return request(app.getHttpServer())
        .get('/api/v1/appointments')
        .set(auth(tokens['doctor@hms.com']))
        .expect(200);
    });
  });

  describe('EMR & ADT', () => {
    it('doctor reads EMR timeline for a patient', () => {
      return request(app.getHttpServer())
        .get(`/api/v1/emr/patient/${samplePatientId}/timeline`)
        .set(auth(tokens['doctor@hms.com']))
        .expect(200);
    });

    it('nurse reads ADT stats and wards', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/adt/stats')
        .set(auth(tokens['nurse@hms.com']))
        .expect(200);
      await request(app.getHttpServer())
        .get('/api/v1/adt/wards')
        .set(auth(tokens['nurse@hms.com']))
        .expect(200);
    });

    it('nurse lists admissions', () => {
      return request(app.getHttpServer())
        .get('/api/v1/adt/admissions')
        .query({ status: 'admitted' })
        .set(auth(tokens['nurse@hms.com']))
        .expect(200);
    });

    it('nurse can read ward beds when ward exists', async () => {
      if (!sampleWardId) return;
      await request(app.getHttpServer())
        .get(`/api/v1/adt/wards/${sampleWardId}/beds`)
        .set(auth(tokens['nurse@hms.com']))
        .expect(200);
    });
  });

  describe('Billing & insurance', () => {
    it('billing lists invoices', () => {
      return request(app.getHttpServer())
        .get('/api/v1/billing/invoices')
        .set(auth(tokens['billing@hms.com']))
        .expect(200);
    });

    it('patient lists my-invoices', () => {
      return request(app.getHttpServer())
        .get('/api/v1/billing/my-invoices')
        .set(auth(tokens['patient@hms.com']))
        .expect(200);
    });

    it('billing lists insurance claims', () => {
      return request(app.getHttpServer())
        .get('/api/v1/insurance/claims')
        .set(auth(tokens['billing@hms.com']))
        .expect(200);
    });
  });

  describe('Reports, lab, pharmacy, notifications', () => {
    it('doctor lists reports', () => {
      return request(app.getHttpServer())
        .get('/api/v1/reports')
        .set(auth(tokens['doctor@hms.com']))
        .expect(200);
    });

    it('patient lists own reports', () => {
      return request(app.getHttpServer())
        .get('/api/v1/reports/mine')
        .set(auth(tokens['patient@hms.com']))
        .expect(200);
    });

    it('lab lists tests and orders', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/lab/tests')
        .set(auth(tokens['lab@hms.com']))
        .expect(200);
      await request(app.getHttpServer())
        .get('/api/v1/lab/orders')
        .set(auth(tokens['lab@hms.com']))
        .expect(200);
    });

    it('pharmacy lists medicines', () => {
      return request(app.getHttpServer())
        .get('/api/v1/pharmacy/medicines')
        .set(auth(tokens['admin@hms.com']))
        .expect(200);
    });

    it('user lists notifications', () => {
      return request(app.getHttpServer())
        .get('/api/v1/notifications')
        .set(auth(tokens['doctor@hms.com']))
        .expect(200);
    });
  });

  describe('Admin & analytics', () => {
    it('admin reads dashboard and public branding', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/dashboard')
        .set(auth(tokens['admin@hms.com']))
        .expect(200);
      await request(app.getHttpServer()).get('/api/v1/admin/hospital-settings/public').expect(200);
    });

    it('admin reads analytics overview', () => {
      return request(app.getHttpServer())
        .get('/api/v1/analytics/overview')
        .set(auth(tokens['admin@hms.com']))
        .expect(200);
    });
  });

  describe('Integrations (stubs)', () => {
    it('integration ping endpoints respond', async () => {
      const admin = auth(tokens['admin@hms.com']);
      await request(app.getHttpServer()).get('/api/v1/integrations/lab/ping').set(admin).expect(200);
      await request(app.getHttpServer()).get('/api/v1/integrations/insurance/ping').set(admin).expect(200);
      await request(app.getHttpServer()).get('/api/v1/integrations/pacs/ping').set(admin).expect(200);
    });
  });
});
