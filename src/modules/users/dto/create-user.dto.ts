import { UserSex } from '../entities/user.entity';

export interface CreateUserDto {
  fullName: string;
  email: string;
  password: string;
  dateOfBirth: string;
  phone: string;
  sex?: UserSex;
  city?: string;
  district?: string;
  address?: string;
  IDCardNumber?: string;
}
