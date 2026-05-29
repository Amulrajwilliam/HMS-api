import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HospitalAppSettings } from '../../modules/admin/entities/hospital-app-settings.entity';
import { IpAllowlistGuard } from './ip-allowlist.guard';

/**
 * Registers the IP allowlist as a global guard here (not in AppModule) so
 * `TypeOrmModule.forFeature([HospitalAppSettings])` is in the same module scope
 * as the guard and repository injection succeeds.
 */
@Module({
  imports: [TypeOrmModule.forFeature([HospitalAppSettings])],
  providers: [
    IpAllowlistGuard,
    { provide: APP_GUARD, useClass: IpAllowlistGuard },
  ],
  exports: [IpAllowlistGuard],
})
export class IpAllowlistModule {}
