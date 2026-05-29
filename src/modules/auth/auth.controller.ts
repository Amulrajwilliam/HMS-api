import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Param,
  Patch,
  Delete,
  UseInterceptors,
  UploadedFile,
  Req,
  Res,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request, Response } from 'express';
import { StreamableFile } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { UserAvatarService } from './user-avatar.service';
import { LoginDto } from './dto/login.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { TwoFactorVerifyLoginDto, TwoFactorEnableDto, TwoFactorDisableDto } from './dto/two-factor.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';

@Controller('auth')
@Roles(
  Role.ADMIN,
  Role.DOCTOR,
  Role.NURSE,
  Role.BILLING,
  Role.LAB,
  Role.PHARMACY,
  Role.RECEPTIONIST,
  Role.PATIENT,
)
export class AuthController {
  constructor(
    private authService: AuthService,
    private avatarService: UserAvatarService,
  ) {}

  // ── Public routes — no JWT required ──────────────────────────────────────
  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('request-otp')
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.authService.requestOtp(dto);
  }

  @Public()
  @Post('verify-otp')
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  @Public()
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Public()
  @Post('refresh')
  @UseGuards(AuthGuard('jwt-refresh'))
  refresh(@CurrentUser() user: any) {
    return this.authService.refresh(user);
  }

  @Public()
  @Post('2fa/verify-login')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  verifyTwoFactorLogin(@Body() dto: TwoFactorVerifyLoginDto) {
    return this.authService.verifyTwoFactorLogin(dto);
  }

  @Public()
  @Get('avatars/:fileName')
  async getAvatar(@Param('fileName') fileName: string, @Res({ passthrough: true }) res: Response) {
    const { stream, contentType } = this.avatarService.readAsset(fileName);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return new StreamableFile(stream);
  }
  // ─────────────────────────────────────────────────────────────────────────

  @Post('logout')
  logout(@CurrentUser() user: any) {
    return this.authService.logout(user.id);
  }

  @Get('me')
  me(@CurrentUser() user: any) {
    return this.authService.me(user.id);
  }

  @Patch('me')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  updateMe(@CurrentUser() user: any, @Body() dto: UpdateMeDto) {
    return this.authService.updateMe(user.id, dto);
  }

  @Post('me/avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 3 * 1024 * 1024 },
    }),
  )
  async uploadAvatar(
    @CurrentUser() user: any,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    const proto = req.protocol;
    const host = req.get('host') || 'localhost';
    const apiPublicPrefix = `${proto}://${host}/api/v1`;
    const updated = await this.avatarService.upload(user.id, file, apiPublicPrefix);
    return this.authService.toPublicUser(updated);
  }

  @Delete('me')
  deleteAccount(@CurrentUser() user: any, @Body() dto: DeleteAccountDto) {
    return this.authService.deleteAccount(user.id, dto);
  }

  @Post('change-password')
  changePassword(@CurrentUser() user: any, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(user.id, dto);
  }

  @Post('2fa/setup')
  createTotpSetup(@CurrentUser() user: any) {
    return this.authService.createTotpSetup(user.id);
  }

  @Post('2fa/enable')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  enableTotp(@CurrentUser() user: any, @Body() dto: TwoFactorEnableDto) {
    return this.authService.enableTotp(user.id, dto);
  }

  @Post('2fa/disable')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  disableTotp(@CurrentUser() user: any, @Body() dto: TwoFactorDisableDto) {
    return this.authService.disableTotp(user.id, dto.password);
  }
}
