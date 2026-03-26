import { IsOptional, IsString } from 'class-validator';

export class LogoutDto {
  @IsOptional()
  @IsString({ message: 'Định dạng refresh token không hợp lệ.' })
  refreshToken?: string;
}
