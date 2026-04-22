# FILE: src/modules/users/users.service.spec.ts

path: src/modules/users/users.service.spec.ts
module: users
kind: spec
language: ts
line_count: 28
size_bytes: 689
sha256: 273f54ce8e2398361b05c3b4debedaf2367435ab94453f411bd81755913cb2cc
updated_at: 2026-04-15T11:49:06.573Z

## SYMBOLS
- (none detected)

## CODE

````ts
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';

import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './entities/user.entity';

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

````
