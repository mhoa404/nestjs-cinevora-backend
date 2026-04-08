import { IsNotEmpty, IsString } from 'class-validator';

export class LogoutDto {
  @IsString({ message: 'Định dạng refresh token không hợp lệ.' })
  @IsNotEmpty({ message: 'Vui lòng cung cấp refresh token' })
  refreshToken!: string;
}
