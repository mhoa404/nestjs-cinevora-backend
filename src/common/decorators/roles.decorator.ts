import { SetMetadata } from '@nestjs/common';
<<<<<<< HEAD
import { UserRole } from '../constants/role.constant';
=======
import { UserRole } from '../../shared/constants/role.constant';
>>>>>>> origin/main

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
