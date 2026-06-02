import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { AiService } from './ai.service';
import { ClerkAuthGuard } from '../common/guards/clerk-auth.guard';
import { CurrentUser } from '../common/guards/current-user.decorator';

@Controller('ai')
@UseGuards(ClerkAuthGuard)
export class AiController {
  constructor(private aiService: AiService) {}

  @Post('chat')
  async chat(@CurrentUser() user: any, @Body() body: { message: string }) {
    const response = await this.aiService.chat(user.id, body.message);
    return { response };
  }

  @Get('daily-plan')
  async dailyPlan(@CurrentUser() user: any) {
    const plan = await this.aiService.generateDailyPlan(user.id);
    return { plan };
  }

  @Get('insights')
  async insights(@CurrentUser() user: any) {
    const insights = await this.aiService.generateAiInsights(user.id);
    return { insights };
  }

  @Post('career')
  async career(@CurrentUser() user: any, @Body() body: { message: string }) {
    const response = await this.aiService.careerCoach(user.id, body.message);
    return { response };
  }
}
