import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';
import { AgeRating, MovieStatus } from '../entities/movie.entity';

export class CreateMovieDto {
  @MaxLength(255, { message: 'Tên phim tối đa 255 ký tự.' })
  @IsString({ message: 'Tên phim không hợp lệ.' })
  @IsNotEmpty({ message: 'Vui lòng nhập tên phim.' })
  title!: string;

  @IsUrl({}, { message: 'Poster phim phải là URL hợp lệ.' })
  @IsNotEmpty({ message: 'Vui lòng cung cấp poster phim.' })
  posterUrl!: string;

  @IsOptional()
  @IsUrl({}, { message: 'Trailer phim phải là URL hợp lệ.' })
  trailerUrl?: string;

  @IsOptional()
  @IsString({ message: 'Mô tả phim không hợp lệ.' })
  description?: string;

  @Min(1, { message: 'Thời lượng phim phải lớn hơn 0.' })
  @IsInt({ message: 'Thời lượng phim phải là số nguyên.' })
  duration!: number;

  @IsOptional()
  @MaxLength(200, { message: 'Tên đạo diễn tối đa 200 ký tự.' })
  @IsString({ message: 'Tên đạo diễn không hợp lệ.' })
  director?: string;

  @IsOptional()
  @IsString({ message: 'Danh sách diễn viên không hợp lệ.' })
  actor?: string;

  @IsOptional()
  @MaxLength(50, { message: 'Ngôn ngữ tối đa 50 ký tự.' })
  @IsString({ message: 'Ngôn ngữ không hợp lệ.' })
  language?: string;

  @IsEnum(AgeRating, { message: 'Giới hạn độ tuổi không hợp lệ.' })
  @IsNotEmpty({ message: 'Vui lòng chọn giới hạn độ tuổi.' })
  ageRating!: AgeRating;

  @IsOptional()
  @MaxLength(100, { message: 'Nhãn đánh giá tối đa 100 ký tự.' })
  @IsString({ message: 'Nhãn đánh giá không hợp lệ.' })
  rated?: string;

  @IsOptional()
  @IsEnum(MovieStatus, { message: 'Trạng thái phim không hợp lệ.' })
  status?: MovieStatus;

  @IsDateString(
    {},
    { message: 'Ngày khởi chiếu không đúng định dạng YYYY-MM-DD.' },
  )
  @IsNotEmpty({ message: 'Vui lòng nhập ngày khởi chiếu.' })
  releaseDate!: string;

  @IsOptional()
  @IsDateString(
    {},
    { message: 'Ngày kết thúc chiếu không đúng định dạng YYYY-MM-DD.' },
  )
  endDate?: string;

  @IsOptional()
  @IsArray({ message: 'genreIds phải là một mảng.' })
  @IsInt({ each: true, message: 'Mỗi genreId phải là số nguyên.' })
  genreIds?: number[];
}
