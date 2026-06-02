import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { HabitsService } from './habits.service';
import { ClerkAuthGuard } from '../common/guards/clerk-auth.guard';
import { CurrentUser } from '../common/guards/current-user.decorator';

@Controller('habits')
@UseGuards(ClerkAuthGuard)
export class HabitsController {
  constructor(private habitsService: HabitsService) {}

  @Post('checkin')
  checkIn(@CurrentUser() user: any, @Body() body: any) {
    return this.habitsService.checkIn(user.id, body);
  }

  @Get('history')
  getHistory(@CurrentUser() user: any) {
    return this.habitsService.getHabitHistory(user.id);
  }

  @Get('scores')
  getScores(@CurrentUser() user: any) {
    return this.habitsService.getHabitScores(user.id);
  }

  @Get('streaks')
  getStreaks(@CurrentUser() user: any) {
    return this.habitsService.getStreaks(user.id);
  }

  @Post('morning-checkin')
  saveMorningCheckin(@CurrentUser() user: any, @Body() body: any) {
    return this.habitsService.saveMorningCheckin(user.id, body);
  }

  @Get('morning-checkin')
  getMorningCheckin(@CurrentUser() user: any) {
    return this.habitsService.getMorningCheckin(user.id);
  }
}
