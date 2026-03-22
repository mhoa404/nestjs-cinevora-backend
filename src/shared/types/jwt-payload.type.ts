import { UserRole } from '../constants/role.constant';
export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  role_level: number;
  iat?: number;
  exp?: number;
}
