import { IsOptional, IsString } from 'class-validator';

export class RefreshTokenDto {
  @IsOptional()
  @IsString({ message: 'Định dạng refresh token không hợp lệ.' })
  refreshToken?: string;
}
