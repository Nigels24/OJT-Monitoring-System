import { Test, TestingModule } from '@nestjs/testing';
import { SupervisorController } from './supervisor.controller';

describe('SupervisorController', () => {
  let controller: SupervisorController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SupervisorController],
    }).compile();

    controller = module.get<SupervisorController>(SupervisorController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
