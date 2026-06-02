import { Module } from '@nestjs/common';
import { FitnessController } from './fitness.controller';
import { FitnessService } from './fitness.service';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule],
  controllers: [FitnessController],
  providers: [FitnessService],
  exports: [FitnessService],
})
export class FitnessModule {}
