import { UserRole } from '../constants/role.constant';
export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  jti?: string;
  iat?: number;
  exp?: number;
}
