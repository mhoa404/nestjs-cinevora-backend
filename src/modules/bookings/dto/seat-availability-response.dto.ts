// src/modules/bookings/dto/seat-availability-response.dto.ts
import { SeatType } from '../../../common/constants/seat-type.constant';

export enum SeatAvailabilityStatus {
  AVAILABLE = 'available',
  HOLDING = 'holding',
  BOOKED = 'booked',
  UNAVAILABLE = 'unavailable',
}

export class SeatAvailabilityResponseDto {
  id!: number;
  seatKey!: string;
  rowLabel!: string;
  seatNumber!: number;
  seatType!: SeatType;
  isActive!: boolean;
  status!: SeatAvailabilityStatus;
  price!: number | null;
}
