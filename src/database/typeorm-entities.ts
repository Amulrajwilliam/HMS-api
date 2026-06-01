import { User } from '../modules/users/entities/user.entity';
import { Patient } from '../modules/patients/entities/patient.entity';
import { PatientProblem } from '../modules/patients/entities/patient-problem.entity';
import { PatientAllergy } from '../modules/patients/entities/patient-allergy.entity';
import { Appointment } from '../modules/appointments/entities/appointment.entity';
import { Invoice, InvoiceItem, Payment } from '../modules/billing/entities/invoice.entity';
import { EmrRecord } from '../modules/emr/entities/emr-record.entity';
import { Ward } from '../modules/adt/entities/ward.entity';
import { Bed } from '../modules/adt/entities/bed.entity';
import { Admission } from '../modules/adt/entities/admission.entity';
import { LabOrder } from '../modules/lab/entities/lab-order.entity';
import { LabTest } from '../modules/lab/entities/lab-test.entity';
import { MedicalReport } from '../modules/reports/entities/medical-report.entity';
import { InsuranceClaim } from '../modules/insurance/entities/insurance-claim.entity';
import { Medicine } from '../modules/pharmacy/entities/medicine.entity';
import { PrescriptionFulfillment } from '../modules/pharmacy/entities/prescription-fulfillment.entity';
import { Notification } from '../modules/notifications/entities/notification.entity';
import { NotificationTemplate } from '../modules/notifications/entities/notification-template.entity';
import { UserPushDevice } from '../modules/notifications/entities/user-push-device.entity';
import { OtpCode } from '../modules/auth/entities/otp-code.entity';
import { HospitalAppSettings } from '../modules/admin/entities/hospital-app-settings.entity';
import { DoctorProfile } from '../modules/staff/entities/doctor-profile.entity';
import { AuditEvent } from '../modules/audit/audit-event.entity';
import { Department } from '../modules/admin/entities/department.entity';
import { BillableService } from '../modules/admin/entities/billable-service.entity';
import {
  EmarAdministration,
  NursingCarePlan,
  NursingEwsScore,
  NursingFlowsheetEntry,
} from '../modules/nursing/entities/nursing-chart.entity';
import { VisitCheckIn } from '../modules/frontdesk/entities/visit-check-in.entity';
import { AppointmentWaitlist } from '../modules/frontdesk/entities/appointment-waitlist.entity';
import { ReminderCampaignLog } from '../modules/frontdesk/entities/reminder-campaign-log.entity';
import { PatientMergeLog } from '../modules/frontdesk/entities/patient-merge-log.entity';

export const TYPEORM_ENTITIES = [
  User,
  Patient,
  PatientProblem,
  PatientAllergy,
  Appointment,
  Invoice,
  InvoiceItem,
  Payment,
  EmrRecord,
  Ward,
  Bed,
  Admission,
  LabOrder,
  LabTest,
  MedicalReport,
  InsuranceClaim,
  Medicine,
  PrescriptionFulfillment,
  Notification,
  NotificationTemplate,
  UserPushDevice,
  OtpCode,
  HospitalAppSettings,
  DoctorProfile,
  AuditEvent,
  Department,
  BillableService,
  NursingFlowsheetEntry,
  NursingCarePlan,
  NursingEwsScore,
  EmarAdministration,
  VisitCheckIn,
  AppointmentWaitlist,
  ReminderCampaignLog,
  PatientMergeLog,
] as const;
