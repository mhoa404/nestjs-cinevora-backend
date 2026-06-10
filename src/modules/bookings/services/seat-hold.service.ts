import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';

import { REDIS_CLIENT } from '../../redis/redis.module';

export interface SeatHoldData {
  bookingId: number;
  userId: string;
  showtimeId: number;
  seatId: number;
  expiresAt: string;
}

@Injectable()
export class SeatHoldService {
  private readonly holdTtlSeconds = 300; // 5 minutes

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async holdSeats(
    showtimeId: number,
    seatIds: number[],
    userId: string,
    bookingId: number,
    expiresAt: Date,
  ): Promise<number[]> {
    const acquiredSeatIds: number[] = [];
    const conflictingSeatIds: number[] = [];

    for (const seatId of seatIds) {
      const value: SeatHoldData = {
        bookingId,
        userId,
        showtimeId,
        seatId,
        expiresAt: expiresAt.toISOString(),
      };

      const result = await this.redis.set(
        this.buildKey(showtimeId, seatId),
        JSON.stringify(value),
        'EX',
        this.holdTtlSeconds,
        'NX',
      );

      if (result === 'OK') {
        acquiredSeatIds.push(seatId);
      } else {
        conflictingSeatIds.push(seatId);
      }
    }

    if (conflictingSeatIds.length > 0) {
      await this.releaseSeats(showtimeId, acquiredSeatIds);
    }

    return conflictingSeatIds;
  }

  async releaseSeats(showtimeId: number, seatIds: number[]): Promise<void> {
    if (seatIds.length === 0) {
      return;
    }

    const keys = seatIds.map((seatId) => this.buildKey(showtimeId, seatId));
    await this.redis.del(...keys);
  }

  async getHeldSeatIds(showtimeId: number): Promise<number[]> {
    const pattern = `booking:hold:showtime:${showtimeId}:seat:*`;
    const seatIds: number[] = [];
    let cursor = '0';

    do {
      const [nextCursor, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100,
      );

      cursor = nextCursor;

      for (const key of keys) {
        const seatId = this.extractSeatIdFromKey(key);
        if (seatId !== null) {
          seatIds.push(seatId);
        }
      }
    } while (cursor !== '0');

    return seatIds;
  }

  async getSeatHold(
    showtimeId: number,
    seatId: number,
  ): Promise<SeatHoldData | null> {
    const value = await this.redis.get(this.buildKey(showtimeId, seatId));

    if (!value) {
      return null;
    }

    try {
      const parsed: unknown = JSON.parse(value);

      if (!this.isSeatHoldData(parsed)) {
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  }

  async isSeatHeld(showtimeId: number, seatId: number): Promise<boolean> {
    const hold = await this.getSeatHold(showtimeId, seatId);
    return hold !== null;
  }

  async getConflictingSeatIds(
    showtimeId: number,
    seatIds: number[],
    currentUserId: string,
  ): Promise<number[]> {
    const conflictingSeatIds: number[] = [];

    for (const seatId of seatIds) {
      const hold = await this.getSeatHold(showtimeId, seatId);

      if (hold && hold.userId !== currentUserId) {
        conflictingSeatIds.push(seatId);
      }
    }

    return conflictingSeatIds;
  }

  private buildKey(showtimeId: number, seatId: number): string {
    return `booking:hold:showtime:${showtimeId}:seat:${seatId}`;
  }

  private extractSeatIdFromKey(key: string): number | null {
    const parts = key.split(':');
    const lastPart = parts.at(-1);

    if (!lastPart) {
      return null;
    }

    const seatId = Number(lastPart);

    if (!Number.isInteger(seatId) || seatId <= 0) {
      return null;
    }

    return seatId;
  }

  private isSeatHoldData(value: unknown): value is SeatHoldData {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const data = value as Partial<SeatHoldData>;

    return (
      typeof data.bookingId === 'number' &&
      typeof data.userId === 'string' &&
      typeof data.showtimeId === 'number' &&
      typeof data.seatId === 'number' &&
      typeof data.expiresAt === 'string'
    );
  }
}
