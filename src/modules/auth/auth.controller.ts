import { Request, Response } from 'express';
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';

import { AuthResponseDto, AuthUserDto } from './dto/auth-response.dto';
import { Public } from '../../common/decorators/public.decorator';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthService } from './auth.service';
import { LogoutDto } from './dto/logout.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
  ): Promise<{ message: string; user: AuthUserDto }> {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async loginWeb(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Omit<AuthResponseDto, 'refreshToken'>> {
    const result = await this.authService.login(dto);

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return {
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      user: result.user,
    };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshWeb(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Omit<AuthResponseDto, 'refreshToken'>> {
    const cookies = req.cookies as Record<string, string | undefined>;
    const token = cookies?.refreshToken;

    if (!token) {
      throw new UnauthorizedException(
        'Không tìm thấy refresh token trong Cookie',
      );
    }

    const result = await this.authService.refreshTokens(token);

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return {
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      user: result.user,
    };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logoutWeb(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    const cookies = req.cookies as Record<string, string | undefined>;
    const token = cookies?.refreshToken;

    if (!token) {
      throw new BadRequestException(
        'Không tìm thấy refresh token trong Cookie',
      );
    }

    await this.authService.logout(token);

    res.clearCookie('refreshToken');

    return { message: 'Đăng xuất thành công' };
  }

  @Public()
  @Post('mobile/login')
  @HttpCode(HttpStatus.OK)
  async loginMobile(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(dto);
  }

  @Public()
  @Post('mobile/refresh')
  @HttpCode(HttpStatus.OK)
  async refreshMobile(@Body() dto: RefreshTokenDto): Promise<AuthResponseDto> {
    if (!dto.refreshToken) {
      throw new BadRequestException('Vui lòng cung cấp refresh token');
    }
    return this.authService.refreshTokens(dto.refreshToken);
  }

  @Public()
  @Post('mobile/logout')
  @HttpCode(HttpStatus.OK)
  async logoutMobile(@Body() dto: LogoutDto): Promise<{ message: string }> {
    if (!dto.refreshToken) {
      throw new BadRequestException('Vui lòng cung cấp refresh token');
    }
    await this.authService.logout(dto.refreshToken);

    return { message: 'Đăng xuất thành công' };
  }
}
