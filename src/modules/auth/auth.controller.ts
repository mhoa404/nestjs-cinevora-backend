import { Request, Response } from 'express';
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';

import { AuthResponseDto, AuthUserDto } from './dto/auth-response.dto';
import { Public } from '../../common/decorators/public.decorator';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthService } from './auth.service';
import { LogoutDto } from './dto/logout.dto';
import { LoginDto } from './dto/login.dto';
import { AuthCookieService } from './services/auth-cookie.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly cookieService: AuthCookieService,
  ) {}

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

    this.cookieService.setCookie(res, result.refreshToken);

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
    const token = this.cookieService.extractCookie(req, 'unauthorized');

    const result = await this.authService.refreshTokens(token);

    this.cookieService.setCookie(res, result.refreshToken);

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
    const token = this.cookieService.extractCookie(req, 'bad_request');

    await this.authService.logout(token);

    this.cookieService.clearCookie(res);

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
    return this.authService.refreshTokens(dto.refreshToken);
  }

  @Public()
  @Post('mobile/logout')
  @HttpCode(HttpStatus.OK)
  async logoutMobile(@Body() dto: LogoutDto): Promise<{ message: string }> {
    await this.authService.logout(dto.refreshToken);
    return { message: 'Đăng xuất thành công' };
  }
}
