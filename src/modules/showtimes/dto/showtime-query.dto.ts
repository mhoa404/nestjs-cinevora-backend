import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional } from 'class-validator';

export class ShowtimeQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'movieId phải là số nguyên.' })
  movieId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'roomId phải là số nguyên.' })
  roomId?: number;

  @IsOptional()
  @IsDateString({}, { message: 'date sai định dạng.' })
  date?: string;
}
