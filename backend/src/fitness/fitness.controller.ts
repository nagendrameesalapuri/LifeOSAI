import { Controller, Post, Get, Body, UseGuards, Param, Query } from '@nestjs/common';
import { FitnessService } from './fitness.service';
import { ClerkAuthGuard } from '../common/guards/clerk-auth.guard';
import { CurrentUser } from '../common/guards/current-user.decorator';

@Controller('fitness')
@UseGuards(ClerkAuthGuard)
export class FitnessController {
  constructor(private fitnessService: FitnessService) {}

  @Post('weight')
  logWeight(@CurrentUser() user: any, @Body() body: any) {
    return this.fitnessService.logWeight(user.id, body);
  }

  @Get('weight/history')
  getWeightHistory(@CurrentUser() user: any) {
    return this.fitnessService.getWeightHistory(user.id);
  }

  @Post('workout')
  logWorkout(@CurrentUser() user: any, @Body() body: any) {
    return this.fitnessService.logWorkout(user.id, body);
  }

  @Get('workout/history')
  getWorkoutHistory(@CurrentUser() user: any) {
    return this.fitnessService.getWorkoutHistory(user.id);
  }

  @Get('workout/plan')
  async getWorkoutPlan(@CurrentUser() user: any) {
    const plan = await this.fitnessService.getWorkoutPlan(user.id);
    return typeof plan === 'string' ? { plan } : plan;
  }

  @Get('workout/overload')
  getProgressiveOverload(@CurrentUser() user: any, @Query('exercise') exercise: string) {
    return this.fitnessService.getProgressiveOverload(user.id, exercise);
  }

  @Get('stats')
  getStats(@CurrentUser() user: any) {
    return this.fitnessService.getFitnessStats(user.id);
  }

  // Workout Program endpoints
  @Post('program/generate')
  async generateProgram(@CurrentUser() user: any) {
    return this.fitnessService.generateProgram(user.id);
  }

  @Get('program/active')
  getActiveProgram(@CurrentUser() user: any) {
    return this.fitnessService.getActiveProgram(user.id);
  }

  @Post('program/session/:sessionId/complete')
  completeSession(@CurrentUser() user: any, @Param('sessionId') sessionId: string, @Body() body: any) {
    return this.fitnessService.completeSession(user.id, sessionId, body.actualLog);
  }

  // Body measurements
  @Post('measurements')
  logMeasurement(@CurrentUser() user: any, @Body() body: any) {
    return this.fitnessService.logBodyMeasurement(user.id, body);
  }

  @Get('measurements')
  getMeasurements(@CurrentUser() user: any) {
    return this.fitnessService.getBodyMeasurements(user.id);
  }
}
