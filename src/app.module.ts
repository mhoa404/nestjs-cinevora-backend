import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { Module } from '@nestjs/common';

import { PromotionsController } from './modules/promotions/promotions.controller';
import { BookingsController } from './modules/bookings/bookings.controller';
import { PromotionsService } from './modules/promotions/promotions.service';
import { PromotionsModule } from './modules/promotions/promotions.module';
// import { PaymentsModule } from './modules/payments/payments.module';
import { ShowtimesModule } from './modules/showtimes/showtimes.module';
import { MoviesController } from './modules/movies/movies.controller';
import { BookingsModule } from './modules/bookings/bookings.module';
import { SeatsController } from './modules/seats/seats.controller';
import { AdminController } from './modules/admin/admin.controller';
import { CinemasModule } from './modules/cinemas/cinemas.module';
import { MoviesService } from './modules/movies/movies.service';
import { MoviesModule } from './modules/movies/movies.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { UsersModule } from './modules/users/users.module';
import { RoomsModule } from './modules/rooms/rooms.module';
import { AdminModule } from './modules/admin/admin.module';
import { SeatsModule } from './modules/seats/seats.module';
import { AuthModule } from './modules/auth/auth.module';
import databaseConfig from './config/database.config';
import { AppController } from './app.controller';
import jwtConfig from './config/jwt.config';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, jwtConfig],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        configService.get('database')!,
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
  ],
  controllers: [
    AppController,
    MoviesController,
    SeatsController,
    BookingsController,
    PromotionsController,
    AdminController,
  ],
  providers: [
    AppService,
    MoviesService,
    PromotionsService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
