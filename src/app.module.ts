import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { join } from 'path';

import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { PatientsModule } from './modules/patients/patients.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { BillingModule } from './modules/billing/billing.module';
import { AdminModule } from './modules/admin/admin.module';
import { EmrModule } from './modules/emr/emr.module';
import { AdtModule } from './modules/adt/adt.module';
import { LabModule } from './modules/lab/lab.module';
import { PharmacyModule } from './modules/pharmacy/pharmacy.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { StaffModule } from './modules/staff/staff.module';
import { ReportsModule } from './modules/reports/reports.module';
import { InsuranceModule } from './modules/insurance/insurance.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { SyncModule } from './modules/sync/sync.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AuditModule } from './modules/audit/audit.module';
import { NursingModule } from './modules/nursing/nursing.module';
import { IpAllowlistModule } from './common/guards/ip-allowlist.module';
import { CommonServicesModule } from './common/common-services.module';

import { TYPEORM_ENTITIES } from './database/typeorm-entities';
import {
  postgresSslOption,
  redisConnectionFromConfig,
} from './config/runtime-data-stores';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        connection: redisConnectionFromConfig(cfg),
      }),
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => {
        const isProd = cfg.get('NODE_ENV') === 'production';
        const syncExplicit = cfg.get('DB_SYNCHRONIZE');
        const synchronize =
          syncExplicit === 'true'
            ? true
            : syncExplicit === 'false'
              ? false
              : !isProd;

        const ssl = postgresSslOption(cfg);
        return {
          type: 'postgres',
          host: cfg.get('DB_HOST', 'localhost'),
          port: cfg.get<number>('DB_PORT', 5432),
          username: cfg.get('DB_USER', 'postgres'),
          password: cfg.get('DB_PASSWORD', 'postgres'),
          database: cfg.get('DB_NAME', 'hms_db'),
          ...(ssl ? { ssl } : {}),
          entities: [...TYPEORM_ENTITIES],
          migrations: [join(__dirname, 'database', 'migrations', '*.{ts,js}')],
          migrationsRun: cfg.get('DB_MIGRATIONS_RUN') === 'true',
          synchronize,
          logging: cfg.get('NODE_ENV') === 'development',
        };
      },
    }),
    AuthModule, UsersModule, PatientsModule, AppointmentsModule,
    BillingModule, AdminModule, EmrModule,
    AdtModule, LabModule, PharmacyModule, NotificationsModule, StaffModule, ReportsModule,     InsuranceModule, IntegrationsModule,
    SyncModule,
    AnalyticsModule,
    AuditModule,
    NursingModule,
    IpAllowlistModule,
    CommonServicesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
