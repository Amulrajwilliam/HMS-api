import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  UsePipes,
  ValidationPipe,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request, Response } from 'express';
import { AdminService } from './admin.service';
import { DepartmentsService } from './departments.service';
import { BillableServicesService } from './billable-services.service';
import { AuditEventsService } from '../audit/audit-events.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import { PatchHospitalSettingsDto } from './dto/patch-hospital-settings.dto';
import { UpsertDoctorProfileDto } from './dto/upsert-doctor-profile.dto';
import { CreateDepartmentDto, PatchDepartmentDto } from './dto/department.dto';
import { CreateBillableServiceDto, PatchBillableServiceDto } from './dto/billable-service.dto';
import { Public } from '../../common/decorators/public.decorator';

@Controller('admin')
@Roles(Role.ADMIN)
export class AdminController {
  constructor(
    private adminService: AdminService,
    private auditEvents: AuditEventsService,
    private departmentsService: DepartmentsService,
    private billableServicesService: BillableServicesService,
  ) {}

  @Public()
  @Get('hospital-settings/public')
  getPublicBranding() {
    return this.adminService.getPublicBranding();
  }

  @Public()
  @Get('hospital-settings/branding-assets/:fileName')
  async getBrandingAsset(@Param('fileName') fileName: string, @Res({ passthrough: true }) res: Response) {
    const { stream, contentType } = await this.adminService.readBrandingAsset(fileName);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate');
    return new StreamableFile(stream);
  }

  @Get('dashboard')
  getDashboard() {
    return this.adminService.getDashboardStats();
  }

  @Get('audit-events')
  listAuditEvents(@Query('page') page = '1', @Query('limit') limit = '50') {
    return this.auditEvents.findPage(+page || 1, +limit || 50);
  }

  @Get('hospital-settings')
  getHospitalSettings() {
    return this.adminService.getHospitalSettings();
  }

  @Patch('hospital-settings')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  patchHospitalSettings(@Body() dto: PatchHospitalSettingsDto) {
    return this.adminService.updateHospitalSettings(dto);
  }

  @Post('hospital-settings/branding-upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  uploadBranding(
    @UploadedFile() file: Express.Multer.File,
    @Query('kind') kind: string,
    @Req() req: Request,
  ) {
    if (kind !== 'logo' && kind !== 'favicon') {
      throw new BadRequestException('Query "kind" must be logo or favicon');
    }
    return this.adminService.uploadBrandingAsset(kind as 'logo' | 'favicon', file);
  }

  @Get('doctor-profiles/:userId')
  getDoctorProfile(@Param('userId') userId: string) {
    return this.adminService.getDoctorProfile(userId);
  }

  @Patch('doctor-profiles/:userId')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  patchDoctorProfile(@Param('userId') userId: string, @Body() dto: UpsertDoctorProfileDto) {
    return this.adminService.upsertDoctorProfile(userId, dto);
  }

  @Get('departments')
  listDepartments(@Query('includeInactive') includeInactive?: string) {
    return this.departmentsService.findAll(includeInactive === 'true' || includeInactive === '1');
  }

  @Post('departments')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  createDepartment(@Body() dto: CreateDepartmentDto) {
    return this.departmentsService.create(dto);
  }

  @Patch('departments/:id')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  patchDepartment(@Param('id') id: string, @Body() dto: PatchDepartmentDto) {
    return this.departmentsService.update(id, dto);
  }

  @Delete('departments/:id')
  removeDepartment(@Param('id') id: string) {
    return this.departmentsService.remove(id);
  }

  @Get('billable-services')
  listBillableServices(@Query('includeInactive') includeInactive?: string) {
    return this.billableServicesService.findAll(includeInactive === 'true' || includeInactive === '1');
  }

  @Post('billable-services')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  createBillableService(@Body() dto: CreateBillableServiceDto) {
    return this.billableServicesService.create(dto);
  }

  @Patch('billable-services/:id')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  patchBillableService(@Param('id') id: string, @Body() dto: PatchBillableServiceDto) {
    return this.billableServicesService.update(id, dto);
  }

  @Delete('billable-services/:id')
  removeBillableService(@Param('id') id: string) {
    return this.billableServicesService.remove(id);
  }
}
