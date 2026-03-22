import { PaginationMeta } from './pagination-meta.interface';
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  meta?: PaginationMeta;
}
