import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';
import { DoctorCredentialingService } from './doctor-credentialing.service';
import { User } from '../users/entities/user.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { DoctorProfile } from './entities/doctor-profile.entity';
import { Department } from '../admin/entities/department.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Appointment, DoctorProfile, Department]),
    UsersModule,
  ],
  controllers: [StaffController],
  providers: [StaffService, DoctorCredentialingService],
  exports: [StaffService, DoctorCredentialingService],
})
export class StaffModule {}
