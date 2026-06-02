import { Controller, Post, Get, Body, UseGuards, Query } from '@nestjs/common';
import { DietService } from './diet.service';
import { ClerkAuthGuard } from '../common/guards/clerk-auth.guard';
import { CurrentUser } from '../common/guards/current-user.decorator';

@Controller('diet')
@UseGuards(ClerkAuthGuard)
export class DietController {
  constructor(private dietService: DietService) {}

  @Post('log')
  logDiet(@CurrentUser() user: any, @Body() body: any) {
    return this.dietService.logDiet(user.id, body);
  }

  @Post('replace')
  replaceDiet(@CurrentUser() user: any, @Body() body: any) {
    return this.dietService.replaceDiet(user.id, body);
  }

  @Get('today')
  getTodayDiet(@CurrentUser() user: any) {
    return this.dietService.getTodayDiet(user.id);
  }

  @Get('history')
  getDietHistory(@CurrentUser() user: any) {
    return this.dietService.getDietHistory(user.id);
  }

  @Get('plan')
  async getDietPlan(@CurrentUser() user: any) {
    const plan = await this.dietService.getDietPlan(user.id);
    return typeof plan === 'string' ? { plan } : plan;
  }

  @Get('stats')
  getDietStats(@CurrentUser() user: any) {
    return this.dietService.getDietStats(user.id);
  }

  @Get('nutrition')
  async getNutrition(@Query('food') food: string, @Query('qty') qty: string) {
    return this.dietService.getNutrition(food, qty);
  }

  @Post('parse-meal')
  async parseMeal(@Body() body: { description: string }) {
    return this.dietService.parseMeal(body.description);
  }

  @Post('water')
  async logWater(@CurrentUser() user: any, @Body() body: { litres: number }) {
    return this.dietService.logWater(user.id, body.litres);
  }

  @Get('water/today')
  async getTodayWater(@CurrentUser() user: any) {
    return this.dietService.getTodayWater(user.id);
  }

  @Get('shopping-list')
  async getShoppingList(@CurrentUser() user: any) {
    return this.dietService.getShoppingList(user.id);
  }

  @Get('meal-timing')
  async getMealTiming(@CurrentUser() user: any) {
    return this.dietService.getMealTimingAdvice(user.id);
  }

  @Get('tdee')
  async getTDEE(@CurrentUser() user: any) {
    return this.dietService.updateUserTargets(user.id);
  }
}
