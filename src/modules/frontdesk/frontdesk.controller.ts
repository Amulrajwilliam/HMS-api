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
import { FrontdeskService } from './frontdesk.service';
import { FrontdeskRemindersService } from './frontdesk-reminders.service';
import { FrontdeskMpiService } from './frontdesk-mpi.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Role } from '../../common/enums/roles.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ReminderCampaignType } from './entities/reminder-campaign-log.entity';
import {
  CheckInDto,
  CreateWaitlistDto,
  MergePatientsDto,
  RunReminderCampaignDto,
  UpdateQueueStatusDto,
  UpdateWaitlistDto,
} from './dto/frontdesk.dto';

@Controller('frontdesk')
export class FrontdeskController {
  constructor(
    private readonly svc: FrontdeskService,
    private readonly reminders: FrontdeskRemindersService,
    private readonly mpi: FrontdeskMpiService,
  ) {}

  @Public()
  @Get('kiosk/display')
  kioskDisplay(@Query('date') date?: string, @Query('department') department?: string) {
    return this.svc.getKioskDisplay(date, department);
  }

  @Post('check-in')
  @Roles(Role.ADMIN, Role.RECEPTIONIST, Role.NURSE, Role.DOCTOR)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  checkIn(@Body() dto: CheckInDto, @CurrentUser() user: { id: string }) {
    return this.svc.checkIn(dto, user.id);
  }

  @Get('queue')
  @Roles(Role.ADMIN, Role.RECEPTIONIST, Role.NURSE, Role.DOCTOR)
  listQueue(
    @Query('date') date?: string,
    @Query('department') department?: string,
    @Query('status') status?: string,
  ) {
    return this.svc.listQueue(date, department, status);
  }

  @Patch('queue/:id/status')
  @Roles(Role.ADMIN, Role.RECEPTIONIST, Role.NURSE, Role.DOCTOR)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  updateQueue(@Param('id') id: string, @Body() dto: UpdateQueueStatusDto) {
    return this.svc.updateQueueStatus(id, dto);
  }

  @Post('waitlist')
  @Roles(Role.ADMIN, Role.RECEPTIONIST, Role.DOCTOR, Role.NURSE)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  createWaitlist(@Body() dto: CreateWaitlistDto) {
    return this.svc.createWaitlist(dto);
  }

  @Get('waitlist')
  @Roles(Role.ADMIN, Role.RECEPTIONIST, Role.DOCTOR, Role.NURSE)
  listWaitlist(@Query('status') status?: string, @Query('doctorId') doctorId?: string) {
    return this.svc.listWaitlist(status, doctorId);
  }

  @Patch('waitlist/:id')
  @Roles(Role.ADMIN, Role.RECEPTIONIST, Role.DOCTOR, Role.NURSE)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  updateWaitlist(@Param('id') id: string, @Body() dto: UpdateWaitlistDto) {
    return this.svc.updateWaitlist(id, dto);
  }

  @Post('waitlist/:id/notify')
  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  notifyWaitlistEntry(@Param('id') id: string) {
    return this.reminders.notifyWaitlistEntry(id);
  }

  @Post('reminders/run')
  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  runReminders(@Body() dto: RunReminderCampaignDto, @CurrentUser() user: { id: string }) {
    return this.reminders.runCampaign(dto.campaignType, user.id);
  }

  @Get('reminders/logs')
  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  listReminderLogs(@Query('page') page = '1') {
    return this.reminders.listLogs(+page || 1, 20);
  }

  @Get('mpi/duplicates')
  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  findDuplicates(@Query('search') search?: string, @Query('limit') limit = '30') {
    return this.mpi.findDuplicateGroups(search, Math.min(100, +limit || 30));
  }

  @Post('mpi/merge')
  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  mergePatients(@Body() dto: MergePatientsDto, @CurrentUser() user: { id: string }) {
    return this.mpi.mergePatients(dto.survivorPatientId, dto.duplicatePatientId, user.id);
  }

  @Get('mpi/merge-logs')
  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  mergeLogs(@Query('page') page = '1') {
    return this.mpi.listMergeLogs(+page || 1, 20);
  }
}
