# FILE: src/modules/users/users.module.ts

path: src/modules/users/users.module.ts
module: users
kind: module
language: ts
line_count: 15
size_bytes: 433
sha256: d9d06c5a0f9d4b1cf9a665b7103491e671b74d34fd51f4b171194363943ee106
updated_at: 2026-04-02T08:59:54.821Z

## SYMBOLS
- UsersModule

## CODE

````ts
import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';

import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}

````
