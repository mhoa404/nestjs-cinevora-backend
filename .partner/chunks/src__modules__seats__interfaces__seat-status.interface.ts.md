# FILE: src/modules/seats/interfaces/seat-status.interface.ts

path: src/modules/seats/interfaces/seat-status.interface.ts
module: seats
kind: interface
language: ts
line_count: 11
size_bytes: 261
sha256: 95b7b80c07ee5f6d6d045946270a9e6e6e1dbfeb7cd52afcb03024cd2740b602
updated_at: 2026-04-08T04:57:37.376Z

## SYMBOLS
- (none detected)

## CODE

````ts
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

````
