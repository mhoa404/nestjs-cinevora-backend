import { SeatType } from '../../../shared/constants/seat-type.constant';
export interface SeatWithStatus {
  id: number;
  seatKey: string;
  rowLabel: string;
  seatNumber: number;
  seatType: SeatType;
  isActive: boolean;
  isAvailable: boolean;
}
