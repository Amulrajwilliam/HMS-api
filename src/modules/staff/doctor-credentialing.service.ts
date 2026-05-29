import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DoctorProfile } from './entities/doctor-profile.entity';
import { User } from '../users/entities/user.entity';
import { Role } from '../../common/enums/roles.enum';

@Injectable()
export class DoctorCredentialingService {
  constructor(
    @InjectRepository(DoctorProfile) private readonly profileRepo: Repository<DoctorProfile>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  /** Throws when the doctor cannot receive new appointments. */
  async assertDoctorBookable(doctorId: string): Promise<void> {
    const doctor = await this.userRepo.findOne({ where: { id: doctorId } });
    if (!doctor || !doctor.isActive || doctor.role !== Role.DOCTOR) {
      throw new NotFoundException('Doctor not found');
    }

    const profile = await this.profileRepo.findOne({ where: { userId: doctorId } });
    this.assertProfileBookable(profile);
  }

  assertProfileBookable(profile: DoctorProfile | null | undefined): void {
    if (!profile) return;

    if (profile.credentialingStatus === 'suspended') {
      throw new BadRequestException(
        'This doctor is suspended and cannot receive new appointments. Contact hospital administration.',
      );
    }

    if (profile.credentialingStatus === 'pending_review') {
      throw new BadRequestException(
        'This doctor profile is pending credentialing review and cannot receive new appointments yet.',
      );
    }

    if (profile.registrationExpiry) {
      const expiry = new Date(profile.registrationExpiry);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (expiry < today) {
        throw new BadRequestException(
          'This doctor\'s medical registration has expired. Update registration before booking appointments.',
        );
      }
    }
  }

  isBookableProfile(profile: DoctorProfile | null | undefined): boolean {
    if (!profile) return true;
    if (profile.credentialingStatus === 'suspended' || profile.credentialingStatus === 'pending_review') {
      return false;
    }
    if (profile.registrationExpiry) {
      const expiry = new Date(profile.registrationExpiry);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (expiry < today) return false;
    }
    return true;
  }
}
