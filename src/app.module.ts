import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import databaseConfig from './config/database.config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { MoviesService } from './modules/movies/movies.service';
import { MoviesController } from './modules/movies/movies.controller';
import { MoviesModule } from './modules/movies/movies.module';
import { CinemasModule } from './modules/cinemas/cinemas.module';
import { RoomsModule } from './modules/rooms/rooms.module';
import { SeatsController } from './modules/seats/seats.controller';
import { SeatsModule } from './modules/seats/seats.module';
import { ShowtimesModule } from './modules/showtimes/showtimes.module';
import { BookingsController } from './modules/bookings/bookings.controller';
import { BookingsModule } from './modules/bookings/bookings.module';
import { PromotionsService } from './modules/promotions/promotions.service';
import { PromotionsController } from './modules/promotions/promotions.controller';
import { PromotionsModule } from './modules/promotions/promotions.module';
import { AdminController } from './modules/admin/admin.controller';
import { AdminModule } from './modules/admin/admin.module';
import { PaymentsModule } from './modules/payments/payments.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => configService.get('database')!,
    }),
    AuthModule,
    UsersModule,
    MoviesModule,
    CinemasModule,
    RoomsModule,
    SeatsModule,
    ShowtimesModule,
    BookingsModule,
    PromotionsModule,
    AdminModule,
    PaymentsModule,
  ],
  controllers: [
    AppController,
    MoviesController,
    SeatsController,
    BookingsController,
    PromotionsController,
    AdminController,
  ],
  providers: [AppService, MoviesService, PromotionsService],
})
export class AppModule { }
