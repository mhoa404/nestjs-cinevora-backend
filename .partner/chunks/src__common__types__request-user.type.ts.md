# FILE: src/common/types/request-user.type.ts

path: src/common/types/request-user.type.ts
module: common
kind: type
language: ts
line_count: 7
size_bytes: 174
sha256: 489ab39d3e82206d357fb1cd93d827818d0fd697fc42112b3fb36299a880bab2
updated_at: 2026-04-08T04:57:37.341Z

## SYMBOLS
- (none detected)

## CODE

````ts
import { Request } from 'express';

import { User } from '../../modules/users/entities/user.entity';
export interface RequestWithUser extends Request {
  user: User;
}

````
