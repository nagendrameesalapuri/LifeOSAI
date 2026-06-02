import { Controller, Post, Get, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ClerkAuthGuard } from '../common/guards/clerk-auth.guard';
import { CurrentUser } from '../common/guards/current-user.decorator';

@Controller('reports')
@UseGuards(ClerkAuthGuard)
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Post('weekly')
  async generateWeekly(@CurrentUser() user: any) {
    const report = await this.reportsService.generateWeeklyReport(user.id);
    return typeof report === 'string' ? { report } : report;
  }

  @Get('all')
  getAll(@CurrentUser() user: any) {
    return this.reportsService.getReports(user.id);
  }

  @Get('latest')
  getLatest(@CurrentUser() user: any) {
    return this.reportsService.getLatestReport(user.id);
  }
}
