export enum UserRole {
  CUSTOMER = 'customer',
  STAFF = 'staff',
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin',
}

export const ROLE_LEVEL: Record<UserRole, number> = {
  [UserRole.CUSTOMER]: 0,
  [UserRole.STAFF]: 10,
  [UserRole.ADMIN]: 50,
  [UserRole.SUPER_ADMIN]: 99,
};
