# FILE: src/modules/users/users.service.ts

path: src/modules/users/users.service.ts
module: users
kind: service
language: ts
line_count: 70
size_bytes: 2090
sha256: d6040c54d36dcc40790d4308240a3d9e5da127c505139926700b99f19c3988e9
updated_at: 2026-04-15T11:47:15.256Z

## SYMBOLS
- UsersService

## CODE

````ts
import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email: email.toLowerCase().trim() },
    });
  }

  async findByPhone(phone: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { phone: phone.trim() },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async createUser(data: CreateUserDto): Promise<User> {
    const normalizedEmail = data.email.toLowerCase().trim();
    const normalizedPhone = data.phone.trim();
    const existing = await this.findByEmail(normalizedEmail);

    if (existing) {
      throw new ConflictException('Email đã được sử dụng');
    }

    const existingPhone = await this.findByPhone(normalizedPhone);
    if (existingPhone) {
      throw new ConflictException('Số điện thoại đã được sử dụng.');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = this.usersRepository.create({
      fullName: data.fullName.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      dateOfBirth: new Date(data.dateOfBirth),
      phone: data.phone.trim(),
      sex: data.sex,
      city: data.city,
      district: data.district,
      address: data.address,
      IDCardNumber: data.IDCardNumber,
    });

    return this.usersRepository.save(user);
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.usersRepository.update(userId, {
      lastLoginAt: new Date(),
    });
  }
}

````
