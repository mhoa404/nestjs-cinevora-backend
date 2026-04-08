import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  accessSecret: process.env.JWT_ACCESS_TOKEN,
  refreshSecret: process.env.JWT_REFRESH_TOKEN,
  accessExpiresInSeconds: 15 * 60,
  refreshExpiresInSeconds: 30 * 24 * 60 * 60,
}));
