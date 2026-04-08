import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { AuthResponseDto, AuthUserDto } from './dto/auth-response.dto';
<<<<<<< HEAD
import { RefreshTokenService } from './services/refresh-token.service';
import { AuthTokenService } from './services/auth-token.service';
import { RecaptchaService } from './services/recaptcha.service';
=======
import { hashRefreshToken } from '../../shared/utils/token-hash.util';
import { JwtPayload } from '../../shared/types/jwt-payload.type';
import { AuthTokens } from './interfaces/auth-tokens.interface';
import { RefreshToken } from './entities/refresh-token.entity';
>>>>>>> origin/main
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

<<<<<<< HEAD
=======
    const tokenHash = hashRefreshToken(oldRefreshToken);

    const storedToken = await this.refreshTokenRepository.findOne({
      where: {
        token: tokenHash,
        isRevoked: false,
      },
    });

    if (!storedToken) {
      throw new UnauthorizedException(
        'Refresh token không hợp lệ hoặc đã bị thu hồi.',
      );
    }

    if (storedToken.expiresAt.getTime() <= Date.now()) {
      await this.revokeRefreshToken(storedToken.id);
      throw new UnauthorizedException('Refresh token đã hết hạn.');
    }

>>>>>>> origin/main
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
<<<<<<< HEAD
    const revoked =
      await this.refreshTokenService.revokeActiveByRawToken(refreshToken);
=======
    const tokenHash = hashRefreshToken(refreshToken);

    const storedToken = await this.refreshTokenRepository.findOne({
      where: { token: tokenHash, isRevoked: false },
    });
>>>>>>> origin/main

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

<<<<<<< HEAD
=======
  private async generateAndSaveTokens(user: User): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      jti: randomUUID(),
    };

    const accessSecret = this.configService.get<string>('jwt.accessSecret');
    const refreshSecret = this.configService.get<string>('jwt.refreshSecret');
    const accessExpiresInSeconds = this.configService.get<number>(
      'jwt.accessExpiresInSeconds',
    );
    const refreshExpiresInSeconds = this.configService.get<number>(
      'jwt.refreshExpiresInSeconds',
    );
    const refreshExpiresInMs = this.configService.get<number>(
      'jwt.refreshExpiresInMs',
    );

    if (
      !accessSecret ||
      !refreshSecret ||
      !accessExpiresInSeconds ||
      !refreshExpiresInSeconds ||
      !refreshExpiresInMs
    ) {
      throw new InternalServerErrorException('Thiếu cấu hình JWT');
    }

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: accessSecret,
      expiresIn: accessExpiresInSeconds,
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: refreshSecret,
      expiresIn: refreshExpiresInSeconds,
    });

    const refreshTokenEntity = this.refreshTokenRepository.create({
      userId: user.id,
      token: hashRefreshToken(refreshToken),
      expiresAt: new Date(Date.now() + refreshExpiresInMs),
      isRevoked: false,
    });

    await this.refreshTokenRepository.save(refreshTokenEntity);

    return {
      accessToken,
      refreshToken,
      expiresIn: accessExpiresInSeconds,
    };
  }

  private async revokeRefreshToken(id: number): Promise<void> {
    await this.refreshTokenRepository.update(id, {
      isRevoked: true,
    });
  }

  private async verifyRecaptcha(token: string): Promise<void> {
    const isEnabled =
      this.configService.get<string>('ENABLE_RECAPTCHA') === 'true';
    if (!isEnabled) {
      return;
    }
    const secretKey = this.configService.get<string>('RECAPTCHA_SECRET_KEY');
    if (!secretKey) {
      throw new InternalServerErrorException(
        'Thiếu cấu hình RECAPTCHA_SECRET_KEY',
      );
    }

    try {
      const response = await axios.post<{
        success: boolean;
        score?: number;
      }>('https://www.google.com/recaptcha/api/siteverify', null, {
        params: {
          secret: secretKey,
          response: token,
        },
      });
      if (!response.data.success) {
        throw new BadRequestException('Xác minh reCAPTCHA thất bại');
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Không thể xác minh reCAPTCHA');
    }
  }

>>>>>>> origin/main
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
