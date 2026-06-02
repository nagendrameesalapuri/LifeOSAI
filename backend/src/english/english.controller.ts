import { Controller, Post, Get, Body, UseGuards, Query, Param } from '@nestjs/common';
import { EnglishService } from './english.service';
import { ClerkAuthGuard } from '../common/guards/clerk-auth.guard';
import { CurrentUser } from '../common/guards/current-user.decorator';

@Controller('english')
@UseGuards(ClerkAuthGuard)
export class EnglishController {
  constructor(private englishService: EnglishService) {}

  @Post('correct')
  correctText(@CurrentUser() user: any, @Body() body: { text: string }) {
    return this.englishService.correctText(user.id, body.text);
  }

  @Get('lesson')
  getLesson(@CurrentUser() user: any, @Query('topic') topic?: string) {
    return this.englishService.getLesson(user.id, topic);
  }

  @Get('lessons/history')
  getLessonHistory(@CurrentUser() user: any) {
    return this.englishService.getLessonHistory(user.id);
  }

  @Post('lessons/complete')
  completeLesson(@CurrentUser() user: any, @Body() body: { dayNumber: number }) {
    return this.englishService.completeLesson(user.id, body.dayNumber);
  }

  @Post('speaking')
  practiceSpeaking(@Body() body: { situation: string }) {
    return this.englishService.practiceSpeaking(body.situation);
  }

  @Get('history')
  getHistory(@CurrentUser() user: any) {
    return this.englishService.getEnglishHistory(user.id);
  }

  @Get('stats')
  getStats(@CurrentUser() user: any) {
    return this.englishService.getEnglishStats(user.id);
  }

  // Error pattern tracking
  @Get('error-patterns')
  getErrorPatterns(@CurrentUser() user: any) {
    return this.englishService.getErrorPatterns(user.id);
  }

  // Vocabulary / Spaced Repetition
  @Get('vocabulary')
  getAllVocabulary(@CurrentUser() user: any, @Query('language') language?: string) {
    return this.englishService.getAllVocabularyCards(user.id, language || 'english');
  }

  @Get('vocabulary/due')
  getDueVocabulary(@CurrentUser() user: any, @Query('language') language?: string) {
    return this.englishService.getDueVocabularyCards(user.id, language || 'english');
  }

  @Get('vocabulary/stats')
  getVocabularyStats(@CurrentUser() user: any) {
    return this.englishService.getVocabularyStats(user.id);
  }

  @Post('vocabulary')
  addVocabularyCard(@CurrentUser() user: any, @Body() body: any) {
    return this.englishService.addVocabularyCard(user.id, body, body.language || 'english');
  }

  @Post('vocabulary/:cardId/review')
  reviewCard(@CurrentUser() user: any, @Param('cardId') cardId: string, @Body() body: { quality: number }) {
    return this.englishService.reviewVocabularyCard(user.id, cardId, body.quality);
  }
}
