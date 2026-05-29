import {
  Module,
  CanActivate,
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import request from 'supertest';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { RolesGuard } from '../src/common/guards/roles.guard';
import { Role } from '../src/common/enums/roles.enum';
import { User } from '../src/modules/users/entities/user.entity';
import { Gender, Patient, PatientStatus } from '../src/modules/patients/entities/patient.entity';
import { MedicalReport } from '../src/modules/reports/entities/medical-report.entity';
import { ReportsModule } from '../src/modules/reports/reports.module';

const reportsTmp = mkdtempSync(join(tmpdir(), 'hms-rep-e2e-'));
process.env.REPORTS_LOCAL_DIR = reportsTmp;

let e2eDoctorId = '';
let e2ePatientId = '';
let e2eRole: Role = Role.DOCTOR;

/** Skip JWT; attach a doctor user for @CurrentUser and @Roles. */
class FakeJwtGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    context.switchToHttp().getRequest().user = {
      id: e2eDoctorId,
      role: e2eRole,
      email: 'reports-e2e@hms.com',
    };
    return true;
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: ':memory:',
      entities: [User, Patient, MedicalReport],
      synchronize: true,
    }),
    ReportsModule,
  ],
  providers: [
    Reflector,
    { provide: APP_GUARD, useClass: FakeJwtGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
class ReportsSqliteE2eModule {}

describe('Reports (e2e, sqlite, local storage)', () => {
  let app!: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ReportsSqliteE2eModule],
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
    const userRepo = ds.getRepository(User);
    const patientRepo = ds.getRepository(Patient);
    const u = await userRepo.save({
      name: 'Reports E2E Doc',
      email: 'reports-e2e@hms.com',
      password: await bcrypt.hash('unused', 8),
      role: Role.DOCTOR,
      isActive: true,
    });
    e2eDoctorId = u.id;
    const p = await patientRepo.save({
      uhid: 'UHID-E2E-1',
      name: 'Reports E2E Patient',
      dob: '1990-01-01',
      gender: Gender.MALE,
      phone: '9876543210',
      email: 'reports-patient-e2e@hms.com',
      status: PatientStatus.ACTIVE,
    });
    e2ePatientId = p.id;
  }, 60000);

  afterAll(async () => {
    await app?.close();
  });

  it('POST /reports/upload → GET /reports → GET /reports/:id/download', async () => {
    const pdf = Buffer.from(
      '%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n',
      'utf-8',
    );

    const up = await request(app.getHttpServer())
      .post('/api/v1/reports/upload')
      .field('title', 'E2E Lab Report')
      .field('reportType', 'lab_pdf')
      .field('patientId', e2ePatientId)
      .attach('file', pdf, { filename: 'minimal.pdf', contentType: 'application/pdf' })
      .expect(201);

    expect(up.body.id).toBeDefined();
    expect(up.body.title).toBe('E2E Lab Report');
    expect(up.body.storageProvider).toBe('local');

    const list = await request(app.getHttpServer()).get('/api/v1/reports').expect(200);

    expect(Array.isArray(list.body.data)).toBe(true);
    const row = list.body.data.find((r: { id: string }) => r.id === up.body.id);
    expect(row).toBeDefined();

    const dl = await request(app.getHttpServer())
      .get(`/api/v1/reports/${up.body.id}/download`)
      .expect(200);

    expect(Buffer.isBuffer(dl.body)).toBe(true);
    expect((dl.body as Buffer).length).toBeGreaterThan(10);

    const presign = await request(app.getHttpServer())
      .get(`/api/v1/reports/${up.body.id}/presign`)
      .expect(200);
    expect(presign.body.url).toBeNull();
  });

  it('requires patientId for staff upload so reports appear in patient portal', async () => {
    const pdf = Buffer.from('%PDF-1.4\n%%EOF\n', 'utf-8');
    await request(app.getHttpServer())
      .post('/api/v1/reports/upload')
      .field('title', 'Unassigned')
      .field('reportType', 'lab_pdf')
      .attach('file', pdf, { filename: 'x.pdf', contentType: 'application/pdf' })
      .expect(400);
  });

  it('rejects upload when reportType is invalid', async () => {
    const payload = Buffer.from('x');
    await request(app.getHttpServer())
      .post('/api/v1/reports/upload')
      .field('title', 'Bad type')
      .field('reportType', 'bad_type')
      .attach('file', payload, { filename: 'x.pdf', contentType: 'application/pdf' })
      .expect(400);
  });

  it('rejects upload when file is missing', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/reports/upload')
      .field('title', 'Missing file')
      .field('reportType', 'lab_pdf')
      .expect(400);
  });

  it('forbids patient role from reports upload', async () => {
    e2eRole = Role.PATIENT;
    const payload = Buffer.from('fake-pdf');
    await request(app.getHttpServer())
      .post('/api/v1/reports/upload')
      .field('title', 'No access')
      .field('reportType', 'lab_pdf')
      .attach('file', payload, { filename: 'x.pdf', contentType: 'application/pdf' })
      .expect(403);
    e2eRole = Role.DOCTOR;
  });
});
