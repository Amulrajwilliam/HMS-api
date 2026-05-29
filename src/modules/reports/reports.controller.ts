import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  Body,
  ParseFilePipe,
  MaxFileSizeValidator,
  Res,
  StreamableFile,
  Header,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { ReportStorageService } from './report-storage.service';
import { CreateReportUploadFieldsDto } from './dto/reports.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

const REPORT_READ_ROLES = [
  Role.ADMIN,
  Role.DOCTOR,
  Role.LAB,
  Role.BILLING,
  Role.NURSE,
  Role.RECEPTIONIST,
] as const;

const REPORT_DETAIL_ROLES = [...REPORT_READ_ROLES, Role.PATIENT] as const;

type RequestUser = { id: string; role?: string; email?: string };

@Controller('reports')
export class ReportsController {
  constructor(
    private readonly svc: ReportsService,
    private readonly storage: ReportStorageService,
  ) {}

  @Post('upload')
  @Roles(Role.ADMIN, Role.DOCTOR, Role.LAB, Role.PATIENT)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 100 * 1024 * 1024 },
    }),
  )
  upload(
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 100 * 1024 * 1024 })],
        fileIsRequired: true,
      }),
    )
    file: Express.Multer.File,
    @Body() body: CreateReportUploadFieldsDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.svc.createFromUpload(file, body, user.id, user);
  }

  @Get('mine')
  @Roles(Role.PATIENT)
  findMine(@Query('page') page = '1', @CurrentUser() user: RequestUser) {
    return this.svc.findAllForPatientUser(user, +page, 20);
  }

  @Get()
  @Roles(...REPORT_READ_ROLES)
  findAll(@Query('page') page = '1', @Query('patientId') patientId?: string) {
    return this.svc.findAll(+page, 20, patientId);
  }

  /** Short-lived signed URL when file is stored in S3 (e.g. DICOM viewer). */
  @Get(':id/presign')
  @Roles(...REPORT_DETAIL_ROLES)
  presign(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.svc.getPresignedUrlForRequester(id, user);
  }

  @Get(':id/download')
  @Roles(...REPORT_DETAIL_ROLES)
  @Header('Cache-Control', 'private, max-age=0')
  async download(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const report = await this.svc.findByIdForRequester(id, user);
    const stream = await this.storage.openReadStream(
      report.storageKey,
      report.storageProvider,
      report.s3Bucket ?? undefined,
    );
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(report.originalFilename)}"`,
    );
    res.setHeader('Content-Type', report.mimeType);
    return new StreamableFile(stream);
  }

  @Get(':id')
  @Roles(...REPORT_DETAIL_ROLES)
  findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.svc.findByIdForRequester(id, user);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.LAB)
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
