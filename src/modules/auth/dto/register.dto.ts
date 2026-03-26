import {
  IsNotEmpty,
  IsString,
  IsEmail,
  IsDateString,
  Matches,
  IsStrongPassword,
  MaxLength,
} from 'class-validator';

export class RegisterDto {
  @MaxLength(100, { message: 'Họ tên tối đa 100 ký tự.' })
  @Matches(/^[A-Za-zÀ-ỹ\s]+$/, {
    message: 'Họ tên không được chứa số hoặc ký tự đặc biệt.',
  })
  @IsString({ message: 'Họ tên không hợp lệ.' })
  @IsNotEmpty({ message: 'Vui lòng điền đủ họ tên.' })
  fullName!: string;

  @IsEmail({}, { message: 'Địa chỉ email không hợp lệ.' })
  @IsNotEmpty({ message: 'Vui lòng nhập địa chỉ email.' })
  email!: string;

  @IsStrongPassword(
    {
      minLength: 8,
      minLowercase: 1,
      minUppercase: 1,
      minSymbols: 1,
    },
    {
      message:
        'Mật khẩu chứa ít nhất 8 ký tự, bao gồm chữ, số, ký tự hoa và ký tự đặc biệt.',
    },
  )
  @IsNotEmpty({ message: 'Vui lòng nhập mật khẩu' })
  password!: string;

  @IsDateString({}, { message: 'Ngày sinh không đúng định dạng (YYYY-MM-DD).' })
  @IsNotEmpty({ message: 'Vui lòng điền ngày tháng năm sinh.' })
  dateOfBirth!: string;

  @Matches(/^(?:3|5|7|8|9)\d{8}$/, {
    message: 'Số điện thoại không hợp lệ.',
  })
  @IsNotEmpty({ message: 'Vui lòng điền số điện thoại.' })
  phone!: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng hoàn thành CAPTCHA.' })
  recaptchaToken!: string;
}
