import { Controller, Get, Post, Patch, Param, Body, Query, Delete } from '@nestjs/common';
import { LabService } from './lab.service';
import { LabOrderStatus } from './entities/lab-order.entity';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import {
  CreateLabOrderDto,
  CreateLabTestDto,
  RecordSampleDto,
  UpdateLabTestDto,
  UploadLabResultsDto,
} from './dto/lab.dto';

@Controller('lab')
export class LabController {
  constructor(private svc: LabService) {}

  // ── Test catalog ─────────────────────────────────────
  @Get('tests')
  @Roles(Role.ADMIN, Role.DOCTOR, Role.LAB)
  listTests(@Query('includeInactive') includeInactive?: string) {
    return this.svc.listTests(includeInactive !== 'true');
  }

  @Post('tests')
  @Roles(Role.ADMIN, Role.LAB)
  createTest(@Body() body: CreateLabTestDto) {
    return this.svc.createTest(body);
  }

  @Patch('tests/:id')
  @Roles(Role.ADMIN, Role.LAB)
  updateTest(@Param('id') id: string, @Body() body: UpdateLabTestDto) {
    return this.svc.updateTest(id, body);
  }

  @Delete('tests/:id')
  @Roles(Role.ADMIN, Role.LAB)
  deactivateTest(@Param('id') id: string) {
    return this.svc.deactivateTest(id);
  }

  // ── Orders ───────────────────────────────────────────
  @Post('orders')
  @Roles(Role.ADMIN, Role.DOCTOR, Role.LAB)
  create(@Body() body: CreateLabOrderDto) {
    return this.svc.create(body);
  }

  @Get('orders')
  @Roles(Role.ADMIN, Role.DOCTOR, Role.LAB, Role.NURSE)
  findAll(
    @Query('page') page = '1',
    @Query('status') status?: string,
    @Query('patientId') patientId?: string,
  ) {
    return this.svc.findAll(+page, 20, status, patientId);
  }

  @Get('orders/pending-count')
  @Roles(Role.ADMIN, Role.LAB, Role.NURSE)
  pendingCount() {
    return this.svc.getPendingCount();
  }

  @Get('orders/:id')
  @Roles(Role.ADMIN, Role.DOCTOR, Role.LAB, Role.NURSE)
  findOne(@Param('id') id: string) {
    return this.svc.findById(id);
  }

  @Patch('orders/:id/status')
  @Roles(Role.ADMIN, Role.LAB)
  updateStatus(@Param('id') id: string, @Body('status') status: LabOrderStatus) {
    return this.svc.updateStatus(id, status);
  }

  @Patch('orders/:id/sample')
  @Roles(Role.ADMIN, Role.LAB, Role.NURSE)
  recordSample(@Param('id') id: string, @Body() body: RecordSampleDto) {
    return this.svc.recordSample(id, body);
  }

  @Patch('orders/:id/results')
  @Roles(Role.ADMIN, Role.LAB)
  uploadResults(@Param('id') id: string, @Body() body: UploadLabResultsDto) {
    return this.svc.uploadResults(id, body);
  }
}
