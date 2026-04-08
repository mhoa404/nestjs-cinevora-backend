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
    });

    return this.usersRepository.save(user);
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.usersRepository.update(userId, {
      lastLoginAt: new Date(),
    });
  }
}
