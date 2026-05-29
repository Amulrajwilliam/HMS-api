import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { NursingService } from './nursing.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  CreateCarePlanDto,
  CreateEmarDto,
  CreateFlowsheetDto,
  RecordEwsDto,
  UpdateCarePlanDto,
  UpdateEmarDto,
} from './dto/nursing.dto';

@Controller('nursing')
@Roles(Role.ADMIN, Role.NURSE, Role.DOCTOR)
export class NursingController {
  constructor(private readonly svc: NursingService) {}

  @Get('patients/:patientId/flowsheet')
  listFlowsheet(@Param('patientId') patientId: string, @Query('limit') limit?: string) {
    return this.svc.listFlowsheet(patientId, limit ? +limit : 30);
  }

  @Post('patients/:patientId/flowsheet')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  addFlowsheet(
    @Param('patientId') patientId: string,
    @CurrentUser() user: { id: string },
    @Body() dto: CreateFlowsheetDto,
  ) {
    return this.svc.addFlowsheet(patientId, user.id, dto);
  }

  @Get('patients/:patientId/care-plans')
  listCarePlans(@Param('patientId') patientId: string) {
    return this.svc.listCarePlans(patientId);
  }

  @Post('patients/:patientId/care-plans')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  addCarePlan(
    @Param('patientId') patientId: string,
    @CurrentUser() user: { id: string },
    @Body() dto: CreateCarePlanDto,
  ) {
    return this.svc.addCarePlan(patientId, user.id, dto);
  }

  @Patch('patients/:patientId/care-plans/:planId')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  updateCarePlan(
    @Param('patientId') patientId: string,
    @Param('planId') planId: string,
    @Body() dto: UpdateCarePlanDto,
  ) {
    return this.svc.updateCarePlan(patientId, planId, dto);
  }

  @Get('patients/:patientId/ews')
  listEws(@Param('patientId') patientId: string) {
    return this.svc.listEws(patientId);
  }

  @Post('patients/:patientId/ews')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  recordEws(
    @Param('patientId') patientId: string,
    @CurrentUser() user: { id: string },
    @Body() dto: RecordEwsDto,
  ) {
    return this.svc.recordEws(patientId, user.id, dto);
  }

  @Get('patients/:patientId/emar')
  listEmar(@Param('patientId') patientId: string) {
    return this.svc.listEmar(patientId);
  }

  @Post('patients/:patientId/emar')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  scheduleEmar(
    @Param('patientId') patientId: string,
    @CurrentUser() user: { id: string },
    @Body() dto: CreateEmarDto,
  ) {
    return this.svc.scheduleEmar(patientId, user.id, dto);
  }

  @Patch('patients/:patientId/emar/:id')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  updateEmar(
    @Param('patientId') patientId: string,
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateEmarDto,
  ) {
    return this.svc.updateEmar(patientId, id, user.id, dto);
  }
}
