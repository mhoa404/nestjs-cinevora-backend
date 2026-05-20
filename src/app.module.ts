import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';

import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';
import redisConfig from './config/redis.config';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AuthModule } from './modules/auth/auth.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { GenresModule } from './modules/genres/genres.module';
import { MoviesModule } from './modules/movies/movies.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { PromotionsModule } from './modules/promotions/promotions.module';
import { RedisModule } from './modules/redis/redis.module';
import { RoomsModule } from './modules/rooms/rooms.module';
import { SeatsModule } from './modules/seats/seats.module';
import { ShowtimesModule } from './modules/showtimes/showtimes.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ['.env.local'],
      isGlobal: true,
      load: [appConfig, databaseConfig, jwtConfig, redisConfig],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        configService.get('database')!,
    }),
    RedisModule,
    AuthModule,
    UsersModule,
    GenresModule,
    MoviesModule,
    RoomsModule,
    SeatsModule,
    ShowtimesModule,
    BookingsModule,
    PaymentsModule,
    PromotionsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
