import { PartialType } from '@nestjs/mapped-types';
import { CreatePatientDto } from './create-patient.dto';

/** All fields optional; validators run when a field is present. */
export class UpdatePatientDto extends PartialType(CreatePatientDto) {}
