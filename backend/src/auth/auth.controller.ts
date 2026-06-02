import {
  Controller,
  Post,
  Headers,
  RawBodyRequest,
  Req,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

@Controller('auth')
export class AuthController {
  constructor(private prisma: PrismaService) {}

  @Post('webhook')
  @HttpCode(200)
  async handleClerkWebhook(
    @Headers('svix-id') svixId: string,
    @Headers('svix-timestamp') svixTimestamp: string,
    @Headers('svix-signature') svixSignature: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    const body = req.body as any;
    const eventType = body?.type;

    if (eventType === 'user.created') {
      const userData = body.data;
      const email = userData.email_addresses?.[0]?.email_address;
      const name = `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || 'User';

      await this.prisma.user.upsert({
        where: { clerkId: userData.id },
        update: { email, name },
        create: {
          clerkId: userData.id,
          email,
          name,
        },
      });
    }

    if (eventType === 'user.updated') {
      const userData = body.data;
      const email = userData.email_addresses?.[0]?.email_address;
      const name = `${userData.first_name || ''} ${userData.last_name || ''}`.trim();

      await this.prisma.user.update({
        where: { clerkId: userData.id },
        data: { email, name },
      });
    }

    return { received: true };
  }
}
