# FILE: src/common/guards/roles.guard.ts

path: src/common/guards/roles.guard.ts
module: common
kind: guard
language: ts
line_count: 54
size_bytes: 1362
sha256: 18d4ef205d40fbe57b65d3b5ab0839e7ac952de6672c0dd97bfa1b6325419296
updated_at: 2026-04-15T13:14:54.026Z

## SYMBOLS
- RolesGuard

## CODE

````ts
// src/common/guards/roles.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '../constants/role.constant';

interface RequestWithUser extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
  };
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // Ép kiểu request sang RequestWithUser để ESLint nhận diện được cấu trúc an toàn
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Bạn chưa xác thực.');
    }

    const hasRole = requiredRoles.includes(user.role);
    if (!hasRole) {
      throw new ForbiddenException(
        'Bạn không có quyền thực hiện hành động này.',
      );
    }

    return true;
  }
}

````
