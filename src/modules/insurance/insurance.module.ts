import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from '../billing/entities/invoice.entity';
import { PatientsModule } from '../patients/patients.module';
import { InsuranceClaim } from './entities/insurance-claim.entity';
import { InsuranceController } from './insurance.controller';
import { InsuranceService } from './insurance.service';

@Module({
  imports: [TypeOrmModule.forFeature([InsuranceClaim, Invoice]), PatientsModule],
  controllers: [InsuranceController],
  providers: [InsuranceService],
  exports: [InsuranceService],
})
export class InsuranceModule {}
