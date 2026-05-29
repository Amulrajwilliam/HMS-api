import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice, InvoiceItem, Payment } from './entities/invoice.entity';
import { BillableService } from '../admin/entities/billable-service.entity';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { PatientsModule } from '../patients/patients.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invoice, InvoiceItem, Payment, BillableService]),
    PatientsModule,
    UsersModule,
  ],
  providers: [BillingService],
  controllers: [BillingController],
  exports: [BillingService],
})
export class BillingModule {}
