import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { MemoryService } from './memory/memory.service';

@Module({
  controllers: [AiController],
  providers: [AiService, MemoryService],
  exports: [AiService, MemoryService],
})
export class AiModule {}
