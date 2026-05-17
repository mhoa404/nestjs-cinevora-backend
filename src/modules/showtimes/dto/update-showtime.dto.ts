import { PartialType } from '@nestjs/mapped-types';
import { ShowtimeItemDto } from './create-showtime.dto';

export class UpdateShowtimeDto extends PartialType(ShowtimeItemDto) {}
