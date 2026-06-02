import { Controller, Get, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { ClerkAuthGuard } from '../common/guards/clerk-auth.guard';
import { CurrentUser } from '../common/guards/current-user.decorator';

@Controller('analytics')
@UseGuards(ClerkAuthGuard)
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Get('dashboard')
  getDashboard(@CurrentUser() user: any) {
    return this.analyticsService.getDashboard(user.id);
  }

  @Get('trends')
  getTrends(@CurrentUser() user: any) {
    return this.analyticsService.getTrends(user.id);
  }

  @Get('insights')
  async getInsights(@CurrentUser() user: any) {
    const insights = await this.analyticsService.getInsights(user.id);
    return typeof insights === 'string' ? { insights } : insights;
  }

  @Get('score-breakdown')
  getScoreBreakdown(@CurrentUser() user: any) {
    return this.analyticsService.getScoreBreakdown(user.id);
  }

  @Get('proactive-insights')
  getProactiveInsights(@CurrentUser() user: any) {
    return this.analyticsService.getProactiveInsights(user.id);
  }

  @Get('correlations')
  getCorrelationInsights(@CurrentUser() user: any) {
    return this.analyticsService.getCorrelationInsights(user.id);
  }
}
