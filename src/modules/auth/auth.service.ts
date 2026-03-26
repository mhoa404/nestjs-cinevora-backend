import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import axios from 'axios';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';

import { AuthResponseDto, AuthUserDto } from './dto/auth-response.dto';
import { JwtPayload } from '../../shared/types/jwt-payload.type';
import { AuthTokens } from './interfaces/auth-tokens.interface';
import { RefreshToken } from './entities/refresh-token.entity';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
  ) {}

  async register(
    dto: RegisterDto,
  ): Promise<{ message: string; user: AuthUserDto }> {
    await this.verifyRecaptcha(dto.recaptchaToken);

    const user = await this.usersService.createUSer({
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

    const tokens = await this.generateAndSaveTokens(user);

    return this.buildAuthResponse(user, tokens);
  }

  async refreshTokens(oldRefreshToken: string): Promise<AuthResponseDto> {
    const refreshSecret = this.configService.get<string>('jwt.refreshSecret');

    if (!refreshSecret) {
      throw new InternalServerErrorException('Thiếu cấu hình refresh secret.');
    }

    let payload: JwtPayload;

    try {
      payload = this.jwtService.verify<JwtPayload>(oldRefreshToken, {
        secret: refreshSecret,
      });
    } catch {
      throw new UnauthorizedException(
        'Refresh token không hợp lệ hoặc đã hết hạn.',
      );
    }

    const storedToken = await this.refreshTokenRepository.findOne({
      where: {
        token: oldRefreshToken,
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

    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException(
        'Tài khoản không tồn tại hoặc đã bị khoá',
      );
    }

    await this.revokeRefreshToken(storedToken.id);

    const newTokens = await this.generateAndSaveTokens(user);

    return this.buildAuthResponse(user, newTokens);
  }

  async logout(refreshToken: string): Promise<void> {
    const storedToken = await this.refreshTokenRepository.findOne({
      where: { token: refreshToken, isRevoked: false },
    });

    if (!storedToken) {
      throw new UnauthorizedException(
        'Refresh token không hợp lệ hoặc đã bị thu hồi',
      );
    }

    await this.revokeRefreshToken(storedToken.id);
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.usersService.findByEmail(email);

    if (!user || !user.isActive) return null;
    const isPasswordMatch = await bcrypt.compare(password, user.password);
    return isPasswordMatch ? user : null;
  }

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
      token: refreshToken,
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

  private buildAuthResponse(user: User, tokens: AuthTokens): AuthResponseDto {
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      user: this.sanitizeUser(user),
    };
  }

  private sanitizeUser(user: User) {
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
