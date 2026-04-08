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
<<<<<<< HEAD
import { UserRole } from '../constants/role.constant';
=======
import { UserRole } from '../../shared/constants/role.constant';
>>>>>>> origin/main

interface RequestWithUser extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
  };
}

@Injectable()
export class RolesGuard implements CanActivate {
<<<<<<< HEAD
  constructor(private reflector: Reflector) { }
=======
  constructor(private reflector: Reflector) {}
>>>>>>> origin/main

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
