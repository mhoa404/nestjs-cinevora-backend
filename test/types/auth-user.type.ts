export type AuthUser = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
  dateOfBirth: string | null;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
};

export type AuthResponse = {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  user: AuthUser;
};
