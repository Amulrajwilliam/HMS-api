import { Body, Controller, Get, Header, Param, Patch, Post, Query, UsePipes, ValidationPipe } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/roles.enum';
import {
  AppealInsuranceClaimDto,
  CheckEligibilityDto,
  CreateInsuranceClaimDto,
  UpdateInsuranceClaimStatusDto,
} from './dto/insurance.dto';
import { InsuranceService } from './insurance.service';

@Controller('insurance')
@Roles(Role.ADMIN, Role.BILLING, Role.RECEPTIONIST, Role.DOCTOR)
export class InsuranceController {
  constructor(private readonly svc: InsuranceService) {}

  @Post('claims')
  @Roles(Role.ADMIN, Role.BILLING, Role.RECEPTIONIST)
  create(@Body() dto: CreateInsuranceClaimDto, @CurrentUser() user: { id: string }) {
    return this.svc.createClaim(dto, user.id);
  }

  @Get('claims')
  list(
    @Query('page') page = '1',
    @Query('status') status?: string,
    @Query('invoiceId') invoiceId?: string,
  ) {
    return this.svc.listClaims(+page, 20, status, invoiceId);
  }

  @Get('claims/denials/list')
  @Roles(Role.ADMIN, Role.BILLING, Role.RECEPTIONIST)
  listDenials(@Query('page') page = '1') {
    return this.svc.listDenials(+page, 20);
  }

  @Get('claims/:id')
  findOne(@Param('id') id: string) {
    return this.svc.findById(id);
  }

  @Patch('claims/:id/status')
  @Roles(Role.ADMIN, Role.BILLING)
  updateStatus(@Param('id') id: string, @Body() dto: UpdateInsuranceClaimStatusDto) {
    return this.svc.updateStatus(id, dto);
  }

  @Post('claims/:id/appeal')
  @Roles(Role.ADMIN, Role.BILLING)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  appeal(@Param('id') id: string, @Body() dto: AppealInsuranceClaimDto) {
    return this.svc.appealClaim(id, dto);
  }

  @Get('claims/:id/export-837')
  @Roles(Role.ADMIN, Role.BILLING)
  @Header('Content-Type', 'application/json')
  export837(@Param('id') id: string) {
    return this.svc.exportClaim837(id);
  }

  @Post('eligibility/check')
  @Roles(Role.ADMIN, Role.BILLING, Role.RECEPTIONIST)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  checkEligibility(@Body() dto: CheckEligibilityDto) {
    return this.svc.checkEligibility(dto);
  }
}
