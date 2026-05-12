// src/modules/bookings/dto/booking-response.dto.ts
import { SeatType } from '../../../common/constants/seat-type.constant';
import { Booking, BookingStatus } from '../entities/booking.entity';

export interface BookingSeatResponseInput {
  id: number;
  seatKey: string;
  seatType: SeatType;
  price: number;
}

export class BookingSeatResponseDto {
  id!: number;
  seatKey!: string;
  seatType!: SeatType;
  price!: number;

  static fromInput(input: BookingSeatResponseInput): BookingSeatResponseDto {
    const dto = new BookingSeatResponseDto();
    dto.id = input.id;
    dto.seatKey = input.seatKey;
    dto.seatType = input.seatType;
    dto.price = input.price;
    return dto;
  }
}

export class BookingResponseDto {
  id!: number;
  status!: BookingStatus;
  totalPrice!: number;
  expiresAt!: string;
  seats!: BookingSeatResponseDto[];

  static fromEntity(
    booking: Booking,
    seats: BookingSeatResponseInput[],
  ): BookingResponseDto {
    const dto = new BookingResponseDto();
    dto.id = booking.id;
    dto.status = booking.status;
    dto.totalPrice = Number(booking.totalPrice);
    dto.expiresAt = booking.expiresAt.toISOString();
    dto.seats = seats.map((seat) => BookingSeatResponseDto.fromInput(seat));
    return dto;
  }
}
