import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { SleepService } from './sleep.service';
import { ClerkAuthGuard } from '../common/guards/clerk-auth.guard';
import { CurrentUser } from '../common/guards/current-user.decorator';

@Controller('sleep')
@UseGuards(ClerkAuthGuard)
export class SleepController {
  constructor(private sleepService: SleepService) {}

  @Post('log')
  logSleep(@CurrentUser() user: any, @Body() body: any) {
    return this.sleepService.logSleep(user.id, body);
  }

  @Get('history')
  getSleepHistory(@CurrentUser() user: any) {
    return this.sleepService.getSleepHistory(user.id);
  }

  @Get('score')
  getSleepScore(@CurrentUser() user: any) {
    return this.sleepService.getSleepScore(user.id);
  }
}
