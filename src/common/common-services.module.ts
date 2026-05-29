import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HospitalAppSettings } from '../modules/admin/entities/hospital-app-settings.entity';
import { EphemeralStoreService } from './services/ephemeral-store.service';
import { PasswordPolicyService } from './services/password-policy.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([HospitalAppSettings])],
  providers: [EphemeralStoreService, PasswordPolicyService],
  exports: [EphemeralStoreService, PasswordPolicyService],
})
export class CommonServicesModule {}
