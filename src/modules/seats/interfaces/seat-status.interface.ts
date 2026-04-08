import { SeatType } from '../../../common/constants/seat-type.constant';
export interface SeatWithStatus {
  id: number;
  seatKey: string;
  rowLabel: string;
  seatNumber: number;
  seatType: SeatType;
  isActive: boolean;
  isAvailable: boolean;
}
