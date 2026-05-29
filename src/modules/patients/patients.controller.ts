import { Controller, Get, Post, Put, Patch, Delete, Param, Body, Query, UsePipes, ValidationPipe } from '@nestjs/common';
import { PatientsService } from './patients.service';
import { PatientClinicalService } from './patient-clinical.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import {
  CreatePatientAllergyDto,
  CreatePatientProblemDto,
  ReconcileAllergiesDto,
  UpdatePatientAllergyDto,
  UpdatePatientProblemDto,
} from './dto/patient-clinical.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('patients')
export class PatientsController {
  constructor(
    private svc: PatientsService,
    private clinical: PatientClinicalService,
  ) {}

  @Get('me/profile')
  @Roles(Role.PATIENT)
  myProfile(@CurrentUser() user: any) {
    return this.svc.findOwnedProfileByUser({ id: user.id, email: user.email });
  }

  @Patch('me/profile')
  @Roles(Role.PATIENT)
  updateMyProfile(@CurrentUser() user: any, @Body() dto: UpdatePatientDto) {
    return this.svc.updateOwnedProfile({ id: user.id, email: user.email }, dto);
  }

  @Post()
  @Roles(Role.ADMIN, Role.DOCTOR, Role.RECEPTIONIST)
  create(@Body() dto: CreatePatientDto) { return this.svc.create(dto); }

  @Get()
  @Roles(Role.ADMIN, Role.DOCTOR, Role.NURSE, Role.RECEPTIONIST, Role.BILLING)
  findAll(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) { return this.svc.findAll(search, status, +page, +limit); }

  @Get('uhid/:uhid')
  @Roles(Role.ADMIN, Role.DOCTOR, Role.NURSE, Role.RECEPTIONIST, Role.BILLING)
  findByUhid(@Param('uhid') uhid: string) { return this.svc.findByUhid(uhid); }

  @Get(':id/problems')
  @Roles(Role.ADMIN, Role.DOCTOR, Role.NURSE, Role.RECEPTIONIST)
  listProblems(@Param('id') id: string) {
    return this.clinical.listProblems(id);
  }

  @Post(':id/problems')
  @Roles(Role.ADMIN, Role.DOCTOR, Role.NURSE)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  createProblem(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: CreatePatientProblemDto,
  ) {
    return this.clinical.createProblem(id, dto, user.id);
  }

  @Patch(':id/problems/:problemId')
  @Roles(Role.ADMIN, Role.DOCTOR, Role.NURSE)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  updateProblem(
    @Param('id') id: string,
    @Param('problemId') problemId: string,
    @Body() dto: UpdatePatientProblemDto,
  ) {
    return this.clinical.updateProblem(id, problemId, dto);
  }

  @Get(':id/allergies')
  @Roles(Role.ADMIN, Role.DOCTOR, Role.NURSE, Role.RECEPTIONIST, Role.BILLING)
  listAllergies(@Param('id') id: string) {
    return this.clinical.listAllergies(id);
  }

  @Post(':id/allergies')
  @Roles(Role.ADMIN, Role.DOCTOR, Role.NURSE, Role.RECEPTIONIST)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  createAllergy(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: CreatePatientAllergyDto,
  ) {
    return this.clinical.createAllergy(id, dto, user.id);
  }

  @Patch(':id/allergies/:allergyId')
  @Roles(Role.ADMIN, Role.DOCTOR, Role.NURSE)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  updateAllergy(
    @Param('id') id: string,
    @Param('allergyId') allergyId: string,
    @Body() dto: UpdatePatientAllergyDto,
  ) {
    return this.clinical.updateAllergy(id, allergyId, dto);
  }

  @Post(':id/allergies/reconcile')
  @Roles(Role.ADMIN, Role.DOCTOR, Role.NURSE)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  reconcileAllergies(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: ReconcileAllergiesDto,
  ) {
    return this.clinical.reconcileAllergies(id, user.id, dto);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.DOCTOR, Role.NURSE, Role.RECEPTIONIST, Role.BILLING)
  findOne(@Param('id') id: string) { return this.svc.findById(id); }

  @Put(':id')
  @Roles(Role.ADMIN, Role.DOCTOR, Role.RECEPTIONIST)
  update(@Param('id') id: string, @Body() dto: UpdatePatientDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) { return this.svc.remove(id); }
}
