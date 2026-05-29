import { Controller, Get, Post, Put, Patch, Param, Body, Query } from '@nestjs/common';
import { PharmacyService } from './pharmacy.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import {
  CreateMedicineDto,
  AdjustStockDto,
  CreateFulfillmentDto,
  FulfillmentStatusDto,
} from './dto/pharmacy.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FulfillmentStatus } from './entities/prescription-fulfillment.entity';

@Controller('pharmacy')
export class PharmacyController {
  constructor(private svc: PharmacyService) {}

  @Get('stats') @Roles(Role.ADMIN, Role.PHARMACY)
  stats() { return this.svc.getStats(); }

  @Get('medicines') @Roles(Role.ADMIN, Role.PHARMACY, Role.DOCTOR)
  findAll(@Query('search') s?: string, @Query('category') c?: string, @Query('lowStock') ls?: string) {
    return this.svc.findAll(s, c, ls === 'true');
  }

  @Get('medicines/low-stock') @Roles(Role.ADMIN, Role.PHARMACY)
  lowStock() { return this.svc.getLowStockAlerts(); }

  @Get('medicines/:id') @Roles(Role.ADMIN, Role.PHARMACY)
  findOne(@Param('id') id: string) { return this.svc.findById(id); }

  @Post('medicines') @Roles(Role.ADMIN, Role.PHARMACY)
  create(@Body() body: CreateMedicineDto) { return this.svc.create(body); }
 
  @Put('medicines/:id') @Roles(Role.ADMIN, Role.PHARMACY)
  update(@Param('id') id: string, @Body() body: CreateMedicineDto) { return this.svc.update(id, body); }
 
  @Patch('medicines/:id/stock') @Roles(Role.ADMIN, Role.PHARMACY)
  adjustStock(
    @Param('id') id: string,
    @Body() body: AdjustStockDto,
  ) { return this.svc.adjustStock(id, body.quantity, body.type); }

  @Get('fulfillment/mine') @Roles(Role.PATIENT)
  listMyFulfillment(@CurrentUser() user: { id: string; email?: string }) {
    return this.svc.listFulfillmentForPatientUser(user);
  }

  @Get('fulfillment') @Roles(Role.ADMIN, Role.PHARMACY, Role.DOCTOR, Role.NURSE, Role.RECEPTIONIST)
  listFulfillment(@Query('status') status?: string) {
    return this.svc.listFulfillment(status);
  }

  @Get('fulfillment/patient/:patientId')
  @Roles(Role.ADMIN, Role.PHARMACY, Role.DOCTOR, Role.NURSE, Role.RECEPTIONIST)
  listFulfillmentForPatient(
    @Param('patientId') patientId: string,
    @Query('status') status?: string,
  ) {
    return this.svc.listFulfillmentForPatient(patientId, status);
  }

  @Post('fulfillment') @Roles(Role.ADMIN, Role.PHARMACY, Role.DOCTOR, Role.RECEPTIONIST)
  createFulfillment(@Body() body: CreateFulfillmentDto) {
    return this.svc.createFulfillment(body);
  }

  @Patch('fulfillment/:id/dispense') @Roles(Role.ADMIN, Role.PHARMACY)
  dispense(@Param('id') id: string, @CurrentUser() user: { id: string }, @Body() body: { notes?: string }) {
    const dto: FulfillmentStatusDto = { status: FulfillmentStatus.DISPENSED, notes: body?.notes };
    return this.svc.updateFulfillmentStatus(id, dto, user.id);
  }

  @Patch('fulfillment/:id/cancel') @Roles(Role.ADMIN, Role.PHARMACY)
  cancel(@Param('id') id: string, @Body() body: { notes?: string }) {
    const dto: FulfillmentStatusDto = { status: FulfillmentStatus.CANCELLED, notes: body?.notes };
    return this.svc.updateFulfillmentStatus(id, dto);
  }
}
