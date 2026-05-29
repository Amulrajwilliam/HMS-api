import { Body, Controller, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import { SyncQueueDto } from './sync.dto';
import { SyncService } from './sync.service';

@Controller('sync')
@Roles(Role.ADMIN, Role.DOCTOR, Role.NURSE, Role.RECEPTIONIST, Role.PATIENT)
export class SyncController {
  constructor(private readonly svc: SyncService) {}

  @Post()
  process(@CurrentUser() user: any, @Body() body: SyncQueueDto) {
    return this.svc.processQueue(user, body);
  }
}
