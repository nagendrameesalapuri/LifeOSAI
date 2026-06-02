import { Controller, Post, Get, Body, UseGuards, Query, Param } from '@nestjs/common';
import { KannadaService } from './kannada.service';
import { ClerkAuthGuard } from '../common/guards/clerk-auth.guard';
import { CurrentUser } from '../common/guards/current-user.decorator';

@Controller('kannada')
@UseGuards(ClerkAuthGuard)
export class KannadaController {
  constructor(private kannadaService: KannadaService) {}

  @Get('lesson')
  async getDailyLesson(@CurrentUser() user: any, @Query('day') day?: string) {
    const lesson = await this.kannadaService.getDailyLesson(user.id, day ? parseInt(day) : undefined);
    return lesson;
  }

  @Get('lesson/:day')
  getLessonByDay(@CurrentUser() user: any, @Param('day') day: string) {
    return this.kannadaService.getLessonByDay(user.id, parseInt(day));
  }

  @Get('curriculum')
  getCurriculum() {
    return this.kannadaService.getCurriculum();
  }

  @Get('script')
  getScriptLesson(@CurrentUser() user: any) {
    return this.kannadaService.getScriptLesson(user.id);
  }

  @Get('lessons/history')
  getLessonHistory(@CurrentUser() user: any) {
    return this.kannadaService.getLessonHistory(user.id);
  }

  @Post('lessons/complete')
  completeLesson(@CurrentUser() user: any, @Body() body: { dayNumber: number }) {
    return this.kannadaService.completeLesson(user.id, body.dayNumber);
  }

  @Post('log')
  logProgress(@CurrentUser() user: any, @Body() body: any) {
    return this.kannadaService.logProgress(user.id, body);
  }

  @Get('progress')
  getProgress(@CurrentUser() user: any) {
    return this.kannadaService.getProgress(user.id);
  }
}
