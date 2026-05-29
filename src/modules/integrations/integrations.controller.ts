import { Body, Controller, Get, Post } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import {
  LookupPacsStudyDto,
  SubmitExternalInsuranceClaimDto,
  SubmitExternalLabOrderDto,
} from './integrations.dto';
import { IntegrationsService } from './integrations.service';

@Controller('integrations')
@Roles(Role.ADMIN)
export class IntegrationsController {
  constructor(private readonly svc: IntegrationsService) {}

  @Get('lab/ping')
  labStub() {
    return this.svc.pingLab();
  }

  @Get('insurance/ping')
  insuranceStub() {
    return this.svc.pingInsurance();
  }

  @Get('pacs/ping')
  pacsStub() {
    return this.svc.pingPacs();
  }

  @Get('telemetry')
  telemetry() {
    return this.svc.getTelemetry();
  }

  @Post('lab/submit-order')
  submitLabOrder(@Body() body: SubmitExternalLabOrderDto) {
    return this.svc.submitLabOrder(body.orderId, body.provider);
  }

  @Post('insurance/submit-claim')
  submitInsuranceClaim(@Body() body: SubmitExternalInsuranceClaimDto) {
    return this.svc.submitInsuranceClaim(body.claimId, body.provider);
  }

  @Post('pacs/lookup-study')
  lookupPacsStudy(@Body() body: LookupPacsStudyDto) {
    return this.svc.lookupPacsStudy(body.studyUid, body.patientMrn);
  }
}
