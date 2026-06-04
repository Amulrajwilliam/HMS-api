import { Controller, Get, Post, Patch, Param, Body, Query } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto, RescheduleAppointmentDto } from './dto/create-appointment.dto';
import { AppointmentStatus } from './entities/appointment.entity';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('appointments')
export class AppointmentsController {
  constructor(private svc: AppointmentsService) {}

  @Post()
  @Roles(Role.ADMIN, Role.DOCTOR, Role.RECEPTIONIST, Role.NURSE, Role.PATIENT)
  create(@Body() dto: CreateAppointmentDto, @CurrentUser() user: any) {
    if (user?.role === Role.PATIENT) {
      return this.svc.createForPatientUser(dto, user);
    }
    return this.svc.create(dto);
  }

  @Get('mine')
  @Roles(Role.PATIENT)
  findMine(@CurrentUser() user: any) {
    return this.svc.findMineForPatient(user);
  }

  @Get('mine/:id')
  @Roles(Role.PATIENT)
  findMineOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.svc.findOneForPatientUser(id, user);
  }

  @Patch('mine/:id/cancel')
  @Roles(Role.PATIENT)
  cancelMine(
    @Param('id') id: string,
    @Body('reason') reason: string | undefined,
    @CurrentUser() user: any,
  ) {
    return this.svc.cancelForPatientUser(id, user, reason);
  }

  @Get()
  @Roles(Role.ADMIN, Role.DOCTOR, Role.RECEPTIONIST, Role.NURSE, Role.BILLING)
  findAll(
    @CurrentUser() user: any,
    @Query('page') page = '1',
    @Query('date') date?: string,
    @Query('status') status?: string,
    @Query('doctorId') doctorId?: string,
    @Query('patientId') patientId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const scopedDoctorId =
      user?.role === Role.DOCTOR && !doctorId ? user.id : doctorId;
    return this.svc.findAll(+page, 20, date, status, scopedDoctorId, patientId, startDate, endDate);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.DOCTOR, Role.RECEPTIONIST, Role.NURSE, Role.BILLING)
  findOne(@Param('id') id: string) { return this.svc.findById(id); }

  @Patch(':id/reschedule')
  @Roles(Role.ADMIN, Role.RECEPTIONIST, Role.DOCTOR, Role.NURSE)
  reschedule(@Param('id') id: string, @Body() dto: RescheduleAppointmentDto) {
    return this.svc.reschedule(id, dto);
  }

  @Patch(':id/status')
  @Roles(Role.ADMIN, Role.DOCTOR, Role.RECEPTIONIST, Role.NURSE)
  updateStatus(@Param('id') id: string, @Body('status') status: AppointmentStatus) {
    return this.svc.updateStatus(id, status);
  }

  @Patch(':id/cancel')
  @Roles(Role.ADMIN, Role.DOCTOR, Role.RECEPTIONIST, Role.NURSE, Role.PATIENT)
  cancel(@Param('id') id: string, @Body('reason') reason?: string, @CurrentUser() user?: any) {
    if (user?.role === Role.PATIENT) {
      return this.svc.cancelForPatientUser(id, user, reason);
    }
    return this.svc.cancel(id, reason);
  }
}
