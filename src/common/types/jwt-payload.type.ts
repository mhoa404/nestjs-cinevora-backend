import { UserRole } from '../constants/role.constant';
export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  role_level?: number;
  jti?: string;
  iat?: number;
  exp?: number;
}
