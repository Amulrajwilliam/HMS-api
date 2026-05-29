import { DataSource } from 'typeorm';
import { User } from '../modules/users/entities/user.entity';
import { Patient } from '../modules/patients/entities/patient.entity';
import { Role } from '../common/enums/roles.enum';

/**
 * Sets Patient.userId when patient.email matches a User.email (case-insensitive).
 * Prefer linking users with role `patient` when multiple users share an email (unlikely).
 */
export async function backfillPatientUserIds(dataSource: DataSource): Promise<number> {
  const userRepo = dataSource.getRepository(User);
  const patientRepo = dataSource.getRepository(Patient);

  const patients = await patientRepo
    .createQueryBuilder('p')
    .where('p.email IS NOT NULL')
    .andWhere("p.email <> ''")
    .getMany();

  let linked = 0;
  for (const p of patients) {
    if (p.userId) continue;
    const email = p.email!.trim().toLowerCase();
    const users = await userRepo
      .createQueryBuilder('u')
      .where('LOWER(u.email) = :email', { email })
      .getMany();

    const portalUser = users.find((u) => u.role === Role.PATIENT);
    const user = portalUser ?? users[0];
    if (!user) continue;

    await patientRepo.update(p.id, { userId: user.id });
    linked++;
    console.log(`  🔗 Linked patient "${p.name}" (${p.email}) → user ${user.email}`);
  }

  return linked;
}
