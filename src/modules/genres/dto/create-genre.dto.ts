import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Trim } from '../../../common/decorators/trim.decorator';

export class CreateGenreDto {
  @Trim()
  @MaxLength(100, { message: 'Tên thể loại tối đa 100 ký tự.' })
  @IsString({ message: 'Tên thể loại không hợp lệ.' })
  @IsNotEmpty({ message: 'Vui lòng nhập tên thể loại.' })
  name!: string;
}
