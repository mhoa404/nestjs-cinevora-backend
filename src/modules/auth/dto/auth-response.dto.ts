export class AuthUserDto {
  id!: string;
  fullName!: string;
  email!: string;
  role!: string;
  isActive!: boolean;
  dateOfBirth!: Date | null;
  phone!: string | null;
  createdAt!: Date;
  updatedAt!: Date;
  lastLoginAt!: Date | null;
}

export class AuthResponseDto {
  accessToken!: string;
  refreshToken!: string;
  expiresIn!: number;
  user!: AuthUserDto;
}
