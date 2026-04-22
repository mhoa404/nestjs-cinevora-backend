# FILE: src/common/guards/jwt-auth.guard.ts

path: src/common/guards/jwt-auth.guard.ts
module: common
kind: guard
language: ts
line_count: 21
size_bytes: 628
sha256: 08cebe6699037e35de7235a378299762564d9c75f172d4e62393c09326535da1
updated_at: 2026-04-02T08:59:54.773Z

## SYMBOLS
- JwtAuthGuard

## CODE

````ts
import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}

````
