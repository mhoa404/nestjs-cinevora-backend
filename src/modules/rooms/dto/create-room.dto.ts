import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class CreateRoomDto {
  @IsString({ message: 'Tên phòng phải là chuỗi' })
  @IsNotEmpty({ message: 'Tên phòng không được để trống' })
  @MaxLength(20, { message: 'Tên phòng không được vượt quá 20 ký tự' })
  @Matches(/^[0-9]{2}$/, {
    message: 'Tên phòng phải theo định dạng 01, 02, 03... (2 chữ số)',
  })
  name!: string;
}
