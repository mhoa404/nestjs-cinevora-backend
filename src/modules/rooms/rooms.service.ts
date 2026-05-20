import {
  BadRequestException,
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
import { assignDefined } from '../../common/utils/assign-defined.util';

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
    this.assertUpdatePayload(dto);

    const room = await this.findEntityById(id);

    if (room.name === dto.name) {
      return RoomResponseDto.fromEntity(room);
    }

    await this.assertNameUnique(dto.name!, id);

    assignDefined(room, { name: dto.name });

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

  private assertUpdatePayload(dto: UpdateRoomDto): void {
    if (!dto || Object.keys(dto).length === 0) {
      throw new BadRequestException('Không có dữ liệu nào để cập nhật.');
    }

    const nullFields = Object.entries(dto)
      .filter(([, value]) => value === null)
      .map(([key]) => key);

    if (nullFields.length > 0) {
      throw new BadRequestException(
        `Không hỗ trợ set null cho PATCH: ${nullFields.join(', ')}.`,
      );
    }

    const emptyStringFields = Object.entries(dto)
      .filter(([, value]) => typeof value === 'string' && value.length === 0)
      .map(([key]) => key);

    if (emptyStringFields.length > 0) {
      throw new BadRequestException(
        `Không hỗ trợ giá trị chuỗi rỗng cho PATCH: ${emptyStringFields.join(', ')}.`,
      );
    }
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
