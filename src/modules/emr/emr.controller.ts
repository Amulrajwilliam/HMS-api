import { Controller, Get, Post, Put, Param, Body, Query, UsePipes, ValidationPipe } from '@nestjs/common';
import { EmrService } from './emr.service';
import { CreateEmrDto } from './dto/create-emr.dto';
import { RecordVitalsDto } from './dto/record-vitals.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('emr')
export class EmrController {
  constructor(private svc: EmrService) {}

  @Post()
  @Roles(Role.ADMIN, Role.DOCTOR)
  create(@CurrentUser() user: any, @Body() dto: CreateEmrDto) {
    return this.svc.create(dto, user);
  }

  @Post('vitals')
  @Roles(Role.ADMIN, Role.NURSE, Role.DOCTOR)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  createVitals(@CurrentUser() user: any, @Body() dto: RecordVitalsDto) {
    return this.svc.createVitals(user, dto);
  }

  /** @deprecated Prefer POST /emr/vitals */
  @Post('nurse/vitals')
  @Roles(Role.ADMIN, Role.NURSE, Role.DOCTOR)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  createNurseVitals(@CurrentUser() user: any, @Body() dto: RecordVitalsDto) {
    return this.svc.createVitals(user, dto);
  }

  @Get('icd/search')
  @Roles(Role.ADMIN, Role.DOCTOR, Role.NURSE)
  searchIcd(@Query('q') q?: string, @Query('limit') limit?: string) {
    return this.svc.searchIcd10(q ?? '', limit ? +limit : 25);
  }

  @Get('drug-interactions/check')
  @Roles(Role.ADMIN, Role.DOCTOR, Role.NURSE, Role.PHARMACY)
  checkDrugInteractions(@Query('drugs') drugs?: string, @Query('patientId') patientId?: string) {
    const list = (drugs ?? '')
      .split(',')
      .map((d) => d.trim())
      .filter(Boolean);
    return this.svc.checkPrescriptionInteractions(list, patientId);
  }

  @Get('patient/:patientId/timeline')
  @Roles(Role.ADMIN, Role.DOCTOR, Role.NURSE, Role.PATIENT, Role.BILLING, Role.RECEPTIONIST)
  getTimeline(
    @Param('patientId') patientId: string,
    @CurrentUser() user: any,
    @Query('limit') limit = '50',
  ) {
    return this.svc.getEmrTimelineForUser(patientId, user, Math.min(500, Math.max(1, +limit || 50)));
  }

  @Get('patient/:patientId/latest')
  @Roles(Role.ADMIN, Role.DOCTOR, Role.NURSE, Role.PATIENT, Role.BILLING, Role.RECEPTIONIST)
  getLatest(@Param('patientId') patientId: string, @CurrentUser() user: any) {
    return this.svc.getLatestByPatientForUser(patientId, user);
  }

  @Get('patient/:patientId')
  @Roles(Role.ADMIN, Role.DOCTOR, Role.NURSE, Role.PATIENT, Role.BILLING, Role.RECEPTIONIST)
  findByPatient(
    @Param('patientId') patientId: string,
    @CurrentUser() user: any,
    @Query('page') page = '1',
  ) { return this.svc.findByPatientForUser(patientId, user, +page); }

  @Get(':id')
  @Roles(Role.ADMIN, Role.DOCTOR, Role.NURSE, Role.PATIENT, Role.BILLING, Role.RECEPTIONIST)
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.svc.findByIdForUser(id, user);
  }

  @Put(':id')
  @Roles(Role.ADMIN, Role.DOCTOR)
  update(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: Partial<CreateEmrDto>) {
    return this.svc.update(id, dto, user);
  }
}
