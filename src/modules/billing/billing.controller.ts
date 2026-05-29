import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { BillingService } from './billing.service';
import { CreateInvoiceDto, CreatePaymentDto } from './dto/billing.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('billing')
export class BillingController {
  constructor(private svc: BillingService) {}

  @Post('invoices')
  @Roles(Role.ADMIN, Role.BILLING, Role.RECEPTIONIST)
  createInvoice(@Body() dto: CreateInvoiceDto) { return this.svc.createInvoice(dto); }

  @Get('invoices')
  @Roles(Role.ADMIN, Role.BILLING, Role.RECEPTIONIST)
  findInvoices(@Query('page') page = '1', @Query('status') status?: string, @Query('patientId') patientId?: string) {
    return this.svc.findAllInvoices(+page, 20, status, patientId);
  }

  @Get('my-invoices')
  @Roles(Role.PATIENT)
  findMyInvoices(
    @CurrentUser() user: any,
    @Query('page') page = '1',
    @Query('status') status?: string,
  ) {
    return this.svc.findInvoicesForPatient(user, +page, 20, status);
  }

  @Get('invoices/summary')
  @Roles(Role.ADMIN, Role.BILLING)
  getSummary() { return this.svc.getRevenueSummary(); }

  @Get('catalog/services')
  @Roles(Role.ADMIN, Role.BILLING, Role.RECEPTIONIST)
  listBillableServices() {
    return this.svc.listActiveBillableServices();
  }

  @Get('payments/:id')
  @Roles(Role.ADMIN, Role.BILLING, Role.RECEPTIONIST, Role.PATIENT)
  findPayment(@Param('id') id: string, @CurrentUser() user: any) {
    return this.svc.findPaymentById(id, user);
  }

  @Get('invoices/:id')
  @Roles(Role.ADMIN, Role.BILLING, Role.RECEPTIONIST, Role.PATIENT)
  findInvoice(@Param('id') id: string, @CurrentUser() user: any) {
    return this.svc.findInvoiceById(id, user);
  }

  @Post('payments')
  @Roles(Role.ADMIN, Role.BILLING, Role.RECEPTIONIST)
  recordPayment(@Body() dto: CreatePaymentDto) { return this.svc.recordPayment(dto); }

  @Post('my-payments')
  @Roles(Role.PATIENT)
  recordMyPayment(@CurrentUser() user: any, @Body() dto: CreatePaymentDto) {
    return this.svc.recordPaymentForPatient(user, dto);
  }

  @Get('invoices/:id/payments')
  @Roles(Role.ADMIN, Role.BILLING, Role.RECEPTIONIST, Role.PATIENT)
  getPayments(@Param('id') id: string, @CurrentUser() user: any) {
    return this.svc.findPaymentsByInvoice(id, user);
  }

  @Get('ar-aging')
  @Roles(Role.ADMIN, Role.BILLING)
  getArAging() {
    return this.svc.getArAging();
  }

  @Get('dunning')
  @Roles(Role.ADMIN, Role.BILLING)
  listDunning() {
    return this.svc.listDunningCandidates();
  }

  @Post('dunning/:invoiceId/remind')
  @Roles(Role.ADMIN, Role.BILLING)
  sendDunning(@Param('invoiceId') invoiceId: string) {
    return this.svc.sendDunningReminder(invoiceId);
  }
}
