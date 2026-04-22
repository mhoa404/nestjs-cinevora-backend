# FILE: src/modules/users/users.controller.spec.ts

path: src/modules/users/users.controller.spec.ts
module: users
kind: spec
language: ts
line_count: 19
size_bytes: 503
sha256: f380514928c606010527ad1caca38218c17ff8ec7d87b0afce970d2b5482684f
updated_at: 2026-03-22T08:37:56.832Z

## SYMBOLS
- (none detected)

## CODE

````ts
import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';

describe('UsersController', () => {
  let controller: UsersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

````
