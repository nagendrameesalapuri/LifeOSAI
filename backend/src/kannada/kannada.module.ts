import { Module } from '@nestjs/common';
import { KannadaController } from './kannada.controller';
import { KannadaService } from './kannada.service';
import { AiModule } from '../ai/ai.module';
import { EnglishModule } from '../english/english.module';

@Module({
  imports: [AiModule, EnglishModule],
  controllers: [KannadaController],
  providers: [KannadaService],
  exports: [KannadaService],
})
export class KannadaModule {}
