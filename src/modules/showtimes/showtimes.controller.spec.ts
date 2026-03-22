import { Test, TestingModule } from '@nestjs/testing';
import { ShowtimesController } from './showtimes.controller';

describe('ShowtimesController', () => {
  let controller: ShowtimesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ShowtimesController],
    }).compile();

    controller = module.get<ShowtimesController>(ShowtimesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
