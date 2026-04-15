import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { AuthResponseDto, AuthUserDto } from './dto/auth-response.dto';
import { RefreshTokenService } from './services/refresh-token.service';
import { AuthTokenService } from './services/auth-token.service';
import { RecaptchaService } from './services/recaptcha.service';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthTokens } from './interfaces/auth-tokens.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly authTokenService: AuthTokenService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly recaptchaService: RecaptchaService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async register(
    dto: RegisterDto,
  ): Promise<{ message: string; user: AuthUserDto }> {
    await this.recaptchaService.verify(dto.recaptchaToken);

    const user = await this.usersService.createUser({
      fullName: dto.fullName,
      email: dto.email,
      password: dto.password,
      dateOfBirth: dto.dateOfBirth,
      phone: dto.phone,
      sex: dto.sex,
      city: dto.city,
      district: dto.district,
      address: dto.address,
      IDCardNumber: dto.IDCardNumber,
    });

    return {
      message: 'Đăng ký tài khoản thành công',
      user: this.sanitizeUser(user),
    };
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.validateUser(dto.email, dto.password);

    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    await this.usersService.updateLastLogin(user.id);

    const tokens = await this.authTokenService.generateTokens(user);
    await this.refreshTokenService.save(
      user.id,
      tokens.refreshToken,
      this.authTokenService.getRefreshExpiresAt(),
    );

    return this.buildAuthResponse(user, tokens);
  }

  async refreshTokens(oldRefreshToken: string): Promise<AuthResponseDto> {
    let payload: { sub: string };

    try {
      payload = this.authTokenService.verifyRefreshToken(oldRefreshToken);
    } catch {
      throw new UnauthorizedException(
        'Refresh token không hợp lệ hoặc đã hết hạn.',
      );
    }

    const user = await this.usersService.findById(payload.sub);

    if (!user || !user.isActive) {
      throw new UnauthorizedException(
        'Tài khoản không tồn tại hoặc đã bị khoá',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const isConsumed = await this.refreshTokenService.consumeValidToken(
        oldRefreshToken,
        manager,
      );

      if (!isConsumed) {
        throw new UnauthorizedException(
          'Refresh token không hợp lệ, đã hết hạn hoặc đã bị thu hồi.',
        );
      }

      const newTokens = await this.authTokenService.generateTokens(user);

      await this.refreshTokenService.save(
        user.id,
        newTokens.refreshToken,
        this.authTokenService.getRefreshExpiresAt(),
        manager,
      );

      return this.buildAuthResponse(user, newTokens);
    });
  }

  async logout(refreshToken: string): Promise<void> {
    const revoked =
      await this.refreshTokenService.revokeActiveByRawToken(refreshToken);

    if (!revoked) {
      throw new UnauthorizedException(
        'Refresh token không hợp lệ, đã hết hạn hoặc đã bị thu hồi.',
      );
    }
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.usersService.findByEmail(email);

    if (!user || !user.isActive) {
      return null;
    }

    const isPasswordMatch = await bcrypt.compare(password, user.password);
    return isPasswordMatch ? user : null;
  }

  private buildAuthResponse(user: User, tokens: AuthTokens): AuthResponseDto {
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      user: this.sanitizeUser(user),
    };
  }

  private sanitizeUser(user: User): AuthUserDto {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      dateOfBirth: user.dateOfBirth,
      phone: user.phone,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt,
    };
  }
}
