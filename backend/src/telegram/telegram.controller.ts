import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { TelegramService } from './telegram.service';

@Controller('telegram')
export class TelegramController {
  constructor(private telegramService: TelegramService) {}

  @Post('webhook')
  @HttpCode(200)
  webhook(@Body() body: any) {
    this.telegramService.processWebhook(body);
    return { ok: true };
  }
}
