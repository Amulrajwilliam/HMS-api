import { DataSource } from 'typeorm';
import { User } from '../modules/users/entities/user.entity';
import { Patient } from '../modules/patients/entities/patient.entity';
import { Appointment } from '../modules/appointments/entities/appointment.entity';
import { Invoice, InvoiceItem, Payment } from '../modules/billing/entities/invoice.entity';
import { EmrRecord } from '../modules/emr/entities/emr-record.entity';
import { Ward, WardType } from '../modules/adt/entities/ward.entity';
import { Bed, BedStatus } from '../modules/adt/entities/bed.entity';
import { Admission } from '../modules/adt/entities/admission.entity';
import { LabOrder } from '../modules/lab/entities/lab-order.entity';
import { Medicine, MedicineCategory } from '../modules/pharmacy/entities/medicine.entity';
import { Notification } from '../modules/notifications/entities/notification.entity';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const ALL_ENTITIES = [
  User, Patient, Appointment, Invoice, InvoiceItem, Payment, 
  EmrRecord, Ward, Bed, Admission, LabOrder, Medicine, Notification
];

async function forceSeed() {
  console.log('🚀 Force Seeding with all entities...');
  
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'hms_db',
    entities: ALL_ENTITIES,
    synchronize: true,
  });

  try {
    await ds.initialize();
    console.log('✅ Database connected.');

    const wardRepo = ds.getRepository(Ward);
    const bedRepo = ds.getRepository(Bed);
    const medicineRepo = ds.getRepository(Medicine);

    // 1. Seed Wards & Beds
    const wards = [
      { name: 'General Ward A', type: WardType.GENERAL, floor: '1st', totalBeds: 5 },
      { name: 'ICU Unit 1',     type: WardType.ICU,     floor: '2nd', totalBeds: 3 },
      { name: 'Maternity Ward', type: WardType.MATERNITY, floor: '3rd', totalBeds: 4 },
    ];

    for (const w of wards) {
      let ward = await wardRepo.findOne({ where: { name: w.name } });
      if (!ward) {
        ward = await wardRepo.save(wardRepo.create(w));
        console.log(`  + Created Ward: ${w.name}`);
        
        for (let i = 1; i <= w.totalBeds; i++) {
          const prefix = w.name.split(' ').map(s => s[0]).join('');
          await bedRepo.save(bedRepo.create({
            bedNumber: `${prefix}-${String(i).padStart(2, '0')}`,
            ward,
            status: BedStatus.AVAILABLE,
            pricePerDay: w.type === WardType.ICU ? 5000 : 1500,
            bedType: w.type === WardType.ICU ? 'Ventilator' : 'Standard',
          }));
        }
      }
    }

    // 2. Seed Medicines
    const meds = [
      { name: 'Calpol 500mg', genericName: 'Paracetamol', manufacturer: 'GSK', category: MedicineCategory.TABLET, unit: 'tab', price: 2.5, stock: 500, reorderLevel: 50, location: 'Shelf A-1' },
      { name: 'Amoxicillin 250', genericName: 'Amoxicillin', manufacturer: 'Cipla', category: MedicineCategory.CAPSULE, unit: 'cap', price: 12.0, stock: 200, reorderLevel: 30, location: 'Shelf B-2' },
      { name: 'Benadryl Syrup', genericName: 'Diphenhydramine', manufacturer: 'J&J', category: MedicineCategory.SYRUP, unit: 'ml', price: 120.0, stock: 15, reorderLevel: 20, location: 'Shelf C-1' },
    ];

    for (const m of meds) {
      const exists = await medicineRepo.findOne({ where: { name: m.name } });
      if (!exists) {
        await medicineRepo.save(medicineRepo.create(m));
        console.log(`  + Created Medicine: ${m.name}`);
      }
    }

    console.log('\n✨ Force Seeding Completed!');
    await ds.destroy();
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

forceSeed();
