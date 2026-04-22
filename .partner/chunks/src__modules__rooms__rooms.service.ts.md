# FILE: src/modules/rooms/rooms.service.ts

path: src/modules/rooms/rooms.service.ts
module: rooms
kind: service
language: ts
line_count: 107
size_bytes: 2994
sha256: 736ba650493c7b07b90c8c2f0eafd2e89d4b83fabe8464df252f237027c8978d
updated_at: 2026-04-21T15:34:55.857Z

## SYMBOLS
- RoomsService

## CODE

````ts
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { RoomResponseDto } from './dto/room-response.dto';
import { Room } from './entities/room.entity';

@Injectable()
export class RoomsService {
  constructor(
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
  ) {}

  async findAll(): Promise<RoomResponseDto[]> {
    const rooms = await this.roomRepository
      .createQueryBuilder('room')
      .loadRelationCountAndMap('room.totalSeats', 'room.seats')
      .orderBy('room.name', 'ASC')
      .getMany();

    return rooms.map((room) => RoomResponseDto.fromEntity(room));
  }

  async findOne(id: number): Promise<RoomResponseDto> {
    const room = await this.findEntityById(id);
    return RoomResponseDto.fromEntity(room);
  }

  async create(dto: CreateRoomDto): Promise<RoomResponseDto> {
    await this.assertNameUnique(dto.name);

    const room = this.roomRepository.create({ name: dto.name });
    const saved = await this.roomRepository.save(room);

    return RoomResponseDto.fromEntity(saved);
  }

  async update(id: number, dto: UpdateRoomDto): Promise<RoomResponseDto> {
    const room = await this.findEntityById(id);

    if (dto.name && dto.name !== room.name) {
      await this.assertNameUnique(dto.name, id);
      room.name = dto.name;
    }

    const saved = await this.roomRepository.save(room);
    return RoomResponseDto.fromEntity(saved);
  }

  async remove(id: number): Promise<void> {
    const room = await this.findEntityById(id);

    // Kiểm tra xem phòng có suất chiếu nào không
    const count = await this.roomRepository
      .createQueryBuilder('room')
      .innerJoin('room.showtimes', 'showtime')
      .where('room.id = :id', { id })
      .getCount();

    if (count > 0) {
      throw new ConflictException('Không thể xoá phòng đang có suất chiếu');
    }

    await this.roomRepository.remove(room);
  }

  private async findEntityById(id: number): Promise<Room> {
    const room = await this.roomRepository
      .createQueryBuilder('room')
      .loadRelationCountAndMap('room.totalSeats', 'room.seats')
      .where('room.id = :id', { id })
      .getOne();

    if (!room) {
      throw new NotFoundException(`Phòng #${id} không tồn tại.`);
    }

    return room;
  }

  private async assertNameUnique(
    name: string,
    excludeId?: number,
  ): Promise<void> {
    const query = this.roomRepository
      .createQueryBuilder('room')
      .where('room.name = :name', { name });

    if (excludeId !== undefined) {
      query.andWhere('room.id != :excludeId', { excludeId });
    }

    const existing = await query.getOne();

    if (existing) {
      throw new ConflictException('Tên phòng đã tồn tại');
    }
  }
}

````
