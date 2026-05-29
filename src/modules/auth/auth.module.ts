import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { UsersModule } from '../users/users.module';
import { OtpCode } from './entities/otp-code.entity';
import { OtpDeliveryService } from './otp-delivery.service';
import { User } from '../users/entities/user.entity';
import { UserAvatarService } from './user-avatar.service';
import { HospitalAppSettings } from '../admin/entities/hospital-app-settings.entity';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}), // secrets injected per-call via ConfigService
    TypeOrmModule.forFeature([OtpCode, User, HospitalAppSettings]),
    UsersModule,
  ],
  providers: [AuthService, JwtStrategy, JwtRefreshStrategy, OtpDeliveryService, UserAvatarService],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
