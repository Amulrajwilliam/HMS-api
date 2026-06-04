import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../modules/users/entities/user.entity';
import { Patient, Gender, BloodGroup } from '../modules/patients/entities/patient.entity';
import { Role } from '../common/enums/roles.enum';
import { DoctorProfile } from '../modules/staff/entities/doctor-profile.entity';
import { Ward, WardType } from '../modules/adt/entities/ward.entity';
import { Bed, BedStatus } from '../modules/adt/entities/bed.entity';
import { Medicine, MedicineCategory } from '../modules/pharmacy/entities/medicine.entity';
import { Appointment, AppointmentStatus, AppointmentType } from '../modules/appointments/entities/appointment.entity';
import { LabTest } from '../modules/lab/entities/lab-test.entity';
import { backfillPatientUserIds } from './backfill-patient-userids';

/**
 * Guarantees `patient@hms.com` portal user has a linked `patients` row (fixes skipped seed when phone existed without email).
 */
async function ensurePatientPortalLink(dataSource: DataSource) {
  const userRepo = dataSource.getRepository(User);
  const patientRepo = dataSource.getRepository(Patient);

  const portalUser = await userRepo.findOne({ where: { email: 'patient@hms.com' } });
  if (!portalUser || portalUser.role !== Role.PATIENT) {
    return;
  }

  const linked = await patientRepo.findOne({ where: { userId: portalUser.id } });
  if (linked) {
    return;
  }

  const byEmail = await patientRepo
    .createQueryBuilder('p')
    .where('LOWER(TRIM(p.email)) = :e', { e: 'patient@hms.com' })
    .getOne();
  if (byEmail) {
    if (!byEmail.userId || byEmail.userId === portalUser.id) {
      await patientRepo.update(byEmail.id, { userId: portalUser.id, email: 'patient@hms.com' });
      console.log('  🔗 ensurePatientPortalLink: linked patient row by email');
    }
    return;
  }

  const demoPhone = '9876543216';
  const byPhone = await patientRepo.findOne({ where: { phone: demoPhone } });
  if (byPhone && (!byPhone.userId || byPhone.userId === portalUser.id)) {
    await patientRepo.update(byPhone.id, {
      email: 'patient@hms.com',
      userId: portalUser.id,
      name: byPhone.name || portalUser.name,
    });
    console.log('  🔗 ensurePatientPortalLink: set email + userId on existing demo phone row');
    return;
  }

  const count = await patientRepo.count({ withDeleted: true });
  const uhid = `UHID-${String(count + 1).padStart(4, '0')}`;
  let phone = demoPhone;
  if (byPhone?.userId && byPhone.userId !== portalUser.id) {
    for (let offset = 0; offset < 9000; offset++) {
      const p = String(9876540000 + offset);
      const taken = await patientRepo.exists({ where: { phone: p } });
      if (!taken) {
        phone = p;
        break;
      }
    }
  }

  await patientRepo.save(
    patientRepo.create({
      name: 'Patient Portal Demo',
      dob: '1990-06-01',
      gender: Gender.MALE,
      bloodGroup: BloodGroup.O_POS,
      phone,
      email: 'patient@hms.com',
      userId: portalUser.id,
      uhid,
    }),
  );
  console.log('  ✅ ensurePatientPortalLink: created portal patient row');
}

const DEMO_USERS = [
  { name: 'Admin User',       email: 'admin@hms.com',        role: Role.ADMIN },
  { name: 'Dr. Arjun Sharma', email: 'doctor@hms.com',       role: Role.DOCTOR },
  { name: 'Ward Nurse',       email: 'nurse@hms.com',        role: Role.NURSE },
  { name: 'Billing Staff',    email: 'billing@hms.com',      role: Role.BILLING },
  { name: 'Lab Technician',   email: 'lab@hms.com',          role: Role.LAB },
  { name: 'Pharmacy Staff',   email: 'pharmacy@hms.com',     role: Role.PHARMACY },
  { name: 'Receptionist',     email: 'receptionist@hms.com', role: Role.RECEPTIONIST },
  { name: 'Patient Portal',   email: 'patient@hms.com',      role: Role.PATIENT },
];

const DEMO_PATIENTS = [
  { name: 'Rajesh Kumar',   dob: '1981-03-15', gender: Gender.MALE,   bloodGroup: BloodGroup.O_POS,  phone: '9876543210', email: 'rajesh@demo.com' },
  { name: 'Priya Nair',     dob: '1994-07-22', gender: Gender.FEMALE, bloodGroup: BloodGroup.A_POS,  phone: '9876543211', email: 'priya@demo.com' },
  { name: 'Arjun Mehta',    dob: '1998-01-10', gender: Gender.MALE,   bloodGroup: BloodGroup.B_POS,  phone: '9876543212', email: 'arjun@demo.com' },
  { name: 'Sunita Rao',     dob: '1971-09-04', gender: Gender.FEMALE, bloodGroup: BloodGroup.AB_NEG, phone: '9876543213' },
  { name: 'Mohan Das',      dob: '1964-12-30', gender: Gender.MALE,   bloodGroup: BloodGroup.O_NEG,  phone: '9876543214' },
  { name: 'Kavita Sharma',  dob: '1987-05-16', gender: Gender.FEMALE, bloodGroup: BloodGroup.A_NEG,  phone: '9876543215' },
  { name: 'Patient Portal Demo', dob: '1990-06-01', gender: Gender.MALE, bloodGroup: BloodGroup.O_POS, phone: '9876543216', email: 'patient@hms.com' },
];

const DEMO_WARDS = [
  { name: 'General Ward A', type: WardType.GENERAL, floor: '1st', totalBeds: 5 },
  { name: 'ICU Unit 1',     type: WardType.ICU,     floor: '2nd', totalBeds: 3 },
  { name: 'Maternity Ward', type: WardType.MATERNITY, floor: '3rd', totalBeds: 4 },
];

const DEMO_LAB_TESTS = [
  { code: 'CBC', name: 'Complete Blood Count (CBC)', price: 250, sampleTypeHint: 'blood', department: 'Hematology' },
  { code: 'BSF', name: 'Blood Sugar Fasting', price: 80, sampleTypeHint: 'blood', department: 'Biochemistry' },
  { code: 'LIP', name: 'Lipid Profile', price: 450, sampleTypeHint: 'blood', department: 'Biochemistry' },
  { code: 'LFT', name: 'Liver Function Test', price: 600, sampleTypeHint: 'blood', department: 'Biochemistry' },
  { code: 'KFT', name: 'Kidney Function Test', price: 550, sampleTypeHint: 'blood', department: 'Biochemistry' },
  { code: 'TSH', name: 'Thyroid (TSH)', price: 350, sampleTypeHint: 'blood', department: 'Endocrinology' },
  { code: 'URE', name: 'Urine Routine', price: 120, sampleTypeHint: 'urine', department: 'Clinical Pathology' },
  { code: 'HBA', name: 'HbA1c', price: 500, sampleTypeHint: 'blood', department: 'Biochemistry' },
];

const DEMO_MEDICINES = [
  { name: 'Calpol 500mg',    genericName: 'Paracetamol', manufacturer: 'GSK', category: MedicineCategory.TABLET, unit: 'tab', price: 2.5, stock: 500, reorderLevel: 50, location: 'Shelf A-1' },
  { name: 'Amoxicillin 250', genericName: 'Amoxicillin', manufacturer: 'Cipla', category: MedicineCategory.CAPSULE, unit: 'cap', price: 12.0, stock: 200, reorderLevel: 30, location: 'Shelf B-2' },
  { name: 'Benadryl Syrup',  genericName: 'Diphenhydramine', manufacturer: 'J&J', category: MedicineCategory.SYRUP, unit: 'ml', price: 120.0, stock: 15, reorderLevel: 20, location: 'Shelf C-1' },
  { name: 'Voveran Injection', genericName: 'Diclofenac', manufacturer: 'Novartis', category: MedicineCategory.INJECTION, unit: 'amp', price: 45.0, stock: 40, reorderLevel: 10, location: 'Cold Storage 1' },
];

export async function seedDatabase(dataSource: DataSource) {
  const userRepo = dataSource.getRepository(User);
  const patientRepo = dataSource.getRepository(Patient);
  const wardRepo = dataSource.getRepository(Ward);
  const bedRepo = dataSource.getRepository(Bed);
  const medicineRepo = dataSource.getRepository(Medicine);
  const appointmentRepo = dataSource.getRepository(Appointment);
  const labTestRepo = dataSource.getRepository(LabTest);

  // Seed users — in dev, keep demo passwords in sync so all roles can sign in with Demo@1234
  const demoPasswordHash = await bcrypt.hash('Demo@1234', 12);
  const syncDemoPasswords = process.env.NODE_ENV !== 'production';
  for (const u of DEMO_USERS) {
    const exists = await userRepo.findOne({ where: { email: u.email } });
    if (!exists) {
      await userRepo.save(userRepo.create({ ...u, password: demoPasswordHash }));
      console.log(`  ✅ Created user: ${u.email}`);
    } else if (syncDemoPasswords) {
      await userRepo.update(exists.id, { password: demoPasswordHash, isActive: true });
      console.log(`  🔄 Demo password synced: ${u.email}`);
    }
  }

  // Demo doctor directory profile (admin-managed fields)
  const demoDoctor = await userRepo.findOne({ where: { email: 'doctor@hms.com' } });
  if (demoDoctor) {
    const dpRepo = dataSource.getRepository(DoctorProfile);
    const hasProfile = await dpRepo.findOne({ where: { userId: demoDoctor.id } });
    if (!hasProfile) {
      await dpRepo.save(
        dpRepo.create({
          userId: demoDoctor.id,
          medicalRegistrationNo: 'MCI-DEMO-1001',
          registrationExpiry: new Date('2030-12-31'),
          specialties: 'General Medicine, Internal Medicine',
          qualification: 'MBBS, MD (Internal Medicine)',
          department: 'General OPD',
          consultationFee: '500.00',
          languages: 'English, Hindi',
          designation: 'Consultant Physician',
          clinicalPhone: '022-0000-0000',
          bio: 'Seeded demo profile for the hospital doctor directory.',
        }),
      );
      console.log('  ✅ Created demo doctor profile for doctor@hms.com');
    }
  }

  // Seed patients
  let uhidCounter = await patientRepo.count() + 1;
  for (const p of DEMO_PATIENTS) {
    const exists = await patientRepo.findOne({ where: { phone: p.phone } });
    if (!exists) {
      const uhid = `UHID-${String(uhidCounter).padStart(4, '0')}`;
      await patientRepo.save(patientRepo.create({ ...p, uhid }));
      console.log(`  ✅ Created patient: ${p.name} (${uhid})`);
      uhidCounter++;
    }
  }

  // Seed Wards & Beds
  for (const w of DEMO_WARDS) {
    let ward = await wardRepo.findOne({ where: { name: w.name } });
    if (!ward) {
      ward = await wardRepo.save(wardRepo.create(w));
      console.log(`  ✅ Created ward: ${w.name}`);
      
      for (let i = 1; i <= w.totalBeds; i++) {
        const bedNumber = `${w.name.split(' ').map(s => s[0]).join('')}-${String(i).padStart(2, '0')}`;
        await bedRepo.save(bedRepo.create({
          bedNumber,
          ward,
          status: BedStatus.AVAILABLE,
          pricePerDay: w.type === WardType.ICU ? 5000 : 1500,
          bedType: w.type === WardType.ICU ? 'Ventilator' : 'Standard',
        }));
      }
      console.log(`     - Created ${w.totalBeds} beds for ${w.name}`);
    }
  }

  // Seed lab test catalog
  for (const t of DEMO_LAB_TESTS) {
    const exists = await labTestRepo.findOne({ where: { code: t.code } });
    if (!exists) {
      await labTestRepo.save(labTestRepo.create({ ...t, isActive: true }));
      console.log(`  ✅ Created lab test: ${t.code} — ${t.name}`);
    }
  }

  // Seed Medicines
  for (const m of DEMO_MEDICINES) {
    const exists = await medicineRepo.findOne({ where: { name: m.name } });
    if (!exists) {
      await medicineRepo.save(medicineRepo.create(m));
      console.log(`  ✅ Created medicine: ${m.name}`);
    }
  }

  // Seed Appointments
  const doctor = await userRepo.findOne({ where: { role: Role.DOCTOR } });
  const [patient] = await patientRepo.find({ take: 1, order: { createdAt: 'ASC' } });
  if (doctor && patient) {
    const exists = await appointmentRepo.findOne({ where: { patient: { id: patient.id } } });
    if (!exists) {
      const now = new Date();
      const date = now.toISOString().slice(0, 10);
      const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;
      await appointmentRepo.save(
        appointmentRepo.create({
          doctor,
          patient,
          date,
          time,
          notes: 'General checkup',
          type: AppointmentType.CONSULTATION,
          status: AppointmentStatus.SCHEDULED,
        }),
      );
      console.log(`  ✅ Created initial appointment for patient: ${patient.name}`);
    }
  }

  const linked = await backfillPatientUserIds(dataSource);
  if (linked > 0) {
    console.log(`  🔗 Backfill: linked ${linked} patient(s) to user accounts by email\n`);
  }

  await ensurePatientPortalLink(dataSource);

  console.log('\n🌱 Database seeding complete!\n');
}
