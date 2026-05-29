import { Controller, Get, Patch, Param, Query, Body, ForbiddenException, UsePipes, ValidationPipe } from '@nestjs/common';
import { StaffService } from './staff.service';
import { PatchDoctorSelfProfileDto } from './dto/patch-doctor-self-profile.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('staff')
export class StaffController {
  constructor(private svc: StaffService) {}

  @Get('me/doctor-profile')
  @Roles(Role.DOCTOR)
  getMyDoctorProfile(@CurrentUser() user: { id: string }) {
    return this.svc.getMyDoctorProfile(user.id);
  }

  @Patch('me/doctor-profile')
  @Roles(Role.DOCTOR)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  patchMyDoctorProfile(@CurrentUser() user: { id: string }, @Body() dto: PatchDoctorSelfProfileDto) {
    return this.svc.patchMyDoctorProfile(user.id, dto);
  }

  /** GET /staff/doctors — list of active doctors (used by appointment booking dropdowns) */
  @Get('doctors')
  @Roles(Role.ADMIN, Role.DOCTOR, Role.NURSE, Role.RECEPTIONIST, Role.PATIENT)
  getDoctors(@Query('bookable') bookable?: string) {
    return this.svc.getDoctors(bookable === 'true' || bookable === '1');
  }

  /** GET /staff — all active staff */
  @Get()
  @Roles(Role.ADMIN)
  getAll() {
    return this.svc.getAll();
  }

  /** GET /staff/doctors/:id/schedule — upcoming schedule for a doctor */
  @Get('doctors/:id/schedule')
  @Roles(Role.ADMIN, Role.DOCTOR, Role.RECEPTIONIST)
  getSchedule(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: string },
    @Query('date') date?: string,
  ) {
    if (user.role === Role.DOCTOR && user.id !== id) {
      throw new ForbiddenException('You can only view your own schedule');
    }
    return this.svc.getDoctorSchedule(id, date);
  }

  /** GET /staff/doctors/:id/availability?date= — clinic template slots + booked overlay */
  @Get('doctors/:id/availability')
  @Roles(Role.ADMIN, Role.DOCTOR, Role.RECEPTIONIST, Role.NURSE, Role.PATIENT)
  getAvailability(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: string },
    @Query('date') date?: string,
  ) {
    if (user.role === Role.DOCTOR && user.id !== id) {
      throw new ForbiddenException('You can only view your own availability');
    }
    const day = date?.slice(0, 10) || new Date().toISOString().split('T')[0];
    return this.svc.getDoctorAvailability(id, day);
  }
}
