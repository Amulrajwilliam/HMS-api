import { Controller, Get, Post, Patch, Param, Body, Query } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import {
  DispatchNotificationDto,
  RegisterPushTokenDto,
  UpsertNotificationTemplateDto,
} from './dto/notifications.dto';

@Controller('notifications')
@Roles(
  Role.ADMIN,
  Role.DOCTOR,
  Role.NURSE,
  Role.BILLING,
  Role.LAB,
  Role.PHARMACY,
  Role.RECEPTIONIST,
  Role.PATIENT,
)
export class NotificationsController {
  constructor(private svc: NotificationsService) {}

  @Get()
  findAll(@CurrentUser() user: any, @Query('page') page = '1') {
    return this.svc.findForUser(user.id, +page);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: any) {
    return this.svc.getUnreadCount(user.id);
  }

  @Post('devices/push-token')
  registerPushToken(@CurrentUser() user: any, @Body() body: RegisterPushTokenDto) {
    return this.svc.registerPushToken(user.id, body);
  }

  @Get('templates')
  @Roles(Role.ADMIN)
  templates() {
    return this.svc.listTemplates();
  }

  @Post('templates/upsert')
  @Roles(Role.ADMIN)
  upsertTemplate(@Body() body: UpsertNotificationTemplateDto) {
    return this.svc.upsertTemplate(body);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.svc.findOneForUser(id, user.id);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: any) {
    return this.svc.markRead(id, user.id);
  }

  @Patch('mark-all-read')
  markAllRead(@CurrentUser() user: any) {
    return this.svc.markAllRead(user.id);
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() body: any) { return this.svc.create(body); }

  @Post('dispatch')
  @Roles(Role.ADMIN)
  dispatch(@Body() body: DispatchNotificationDto) {
    return this.svc.dispatch(body);
  }
}
