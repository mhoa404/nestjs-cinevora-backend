import { BookingStatus } from "../../bookings/entities/booking.entity";

export interface AdminStats {
  totalUsers: number;
  totalBookings: number;
  totalRevenue: number;
  bookingByStatus: Record<BookingStatus, number>;
  topMovies: TopMovieStat[];
}

export interface TopMovieStat {
  movieId: string;
  title: string;
  bookingCount: number;
  revenue: number;
}
