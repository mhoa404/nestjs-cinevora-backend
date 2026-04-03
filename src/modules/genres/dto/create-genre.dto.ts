import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateGenreDto {
  @MaxLength(100, { message: 'Tên thể loại tối đa 100 ký tự.' })
  @IsString({ message: 'Tên thể loại không hợp lệ.' })
  @IsNotEmpty({ message: 'Vui lòng nhập tên thể loại.' })
  name!: string;
}
