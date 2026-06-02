import { Module } from '@nestjs/common';
import { EnglishController } from './english.controller';
import { EnglishService } from './english.service';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule],
  controllers: [EnglishController],
  providers: [EnglishService],
  exports: [EnglishService],
})
export class EnglishModule {}
