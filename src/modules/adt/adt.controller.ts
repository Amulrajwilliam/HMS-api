import { Controller, Get, Post, Patch, Param, Body, Query } from '@nestjs/common';
import { AdtService } from './adt.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import { CreateWardDto, CreateBedDto, AdmitPatientDto } from './dto/adt.dto';
import { DischargeAdmissionDto } from './dto/discharge-admission.dto';

@Controller('adt')
export class AdtController {
  constructor(private svc: AdtService) {}

  @Get('stats') @Roles(Role.ADMIN, Role.NURSE, Role.RECEPTIONIST, Role.DOCTOR)
  stats() { return this.svc.getOccupancyStats(); }

  @Get('wards') @Roles(Role.ADMIN, Role.NURSE, Role.RECEPTIONIST, Role.DOCTOR)
  wards() { return this.svc.getWards(); }

  @Post('wards') @Roles(Role.ADMIN)
  createWard(@Body() body: CreateWardDto) { return this.svc.createWard(body); }

  @Get('wards/:wardId/beds') @Roles(Role.ADMIN, Role.NURSE, Role.RECEPTIONIST, Role.DOCTOR)
  beds(@Param('wardId') wardId: string) { return this.svc.getBedsByWard(wardId); }

  @Get('beds/available') @Roles(Role.ADMIN, Role.NURSE, Role.RECEPTIONIST, Role.DOCTOR)
  availableBeds() { return this.svc.getAvailableBeds(); }

  @Post('beds') @Roles(Role.ADMIN)
  createBed(@Body() body: CreateBedDto) { return this.svc.createBed(body); }

  @Get('admissions') @Roles(Role.ADMIN, Role.NURSE, Role.RECEPTIONIST, Role.DOCTOR)
  admissions(@Query('page') page = '1', @Query('status') status?: string) {
    return this.svc.getAdmissions(+page, 20, status);
  }

  @Get('admissions/patient/:patientId') @Roles(Role.ADMIN, Role.NURSE, Role.DOCTOR)
  byPatient(@Param('patientId') pid: string) { return this.svc.getAdmissionsByPatient(pid); }

  @Get('admissions/:id') @Roles(Role.ADMIN, Role.NURSE, Role.RECEPTIONIST, Role.DOCTOR)
  byId(@Param('id') id: string) { return this.svc.getAdmissionById(id); }

  @Post('admissions') @Roles(Role.ADMIN, Role.NURSE, Role.RECEPTIONIST, Role.DOCTOR)
  admit(@Body() body: AdmitPatientDto) { return this.svc.admit(body); }

  @Patch('admissions/:id/discharge')
  @Roles(Role.ADMIN, Role.NURSE, Role.DOCTOR, Role.RECEPTIONIST)
  discharge(@Param('id') id: string, @Body() dto: DischargeAdmissionDto) {
    return this.svc.discharge(id, dto.summary);
  }
}
