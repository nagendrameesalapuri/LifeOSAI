import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { CareerService } from './career.service';
import { ClerkAuthGuard } from '../common/guards/clerk-auth.guard';
import { CurrentUser } from '../common/guards/current-user.decorator';

@Controller('career')
@UseGuards(ClerkAuthGuard)
export class CareerController {
  constructor(private careerService: CareerService) {}

  @Post('study')
  logStudy(@CurrentUser() user: any, @Body() body: any) {
    return this.careerService.logStudy(user.id, body);
  }

  @Get('history')
  getHistory(@CurrentUser() user: any) {
    return this.careerService.getStudyHistory(user.id);
  }

  @Get('roadmap')
  async getRoadmap(@CurrentUser() user: any) {
    const roadmap = await this.careerService.getRoadmap(user.id);
    return typeof roadmap === 'string' ? { roadmap } : roadmap;
  }

  @Post('chat')
  async chat(@CurrentUser() user: any, @Body() body: { message: string }) {
    const response = await this.careerService.careerChat(user.id, body.message);
    return typeof response === 'string' ? { response } : response;
  }

  @Get('stats')
  getStats(@CurrentUser() user: any) {
    return this.careerService.getCareerStats(user.id);
  }
}
