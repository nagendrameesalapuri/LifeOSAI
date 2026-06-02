import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// Only original User columns — safe without migration
const SAFE_USER_SELECT = {
  id: true, clerkId: true, email: true, name: true,
  weightKg: true, targetWeightKg: true,
  heightCm: true, age: true, profession: true,
  createdAt: true, updatedAt: true,
};

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('No token provided');
    }

    const token = authHeader.split(' ')[1];

    let payload: any;
    try {
      const parts = token.split('.');
      if (parts.length !== 3) throw new Error('Invalid JWT');
      const raw = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      payload = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
    } catch {
      throw new UnauthorizedException('Invalid token');
    }

    const googleId = payload.sub || payload.googleId;
    const email = payload.email;
    const name = payload.name || email?.split('@')[0] || 'User';

    if (!googleId && !email) throw new UnauthorizedException('Invalid token');

    const lookupId = googleId || email;

    try {
      let user = await this.prisma.user.findFirst({
        where: { OR: [{ clerkId: lookupId }, { email: email || '' }] },
        select: SAFE_USER_SELECT,
      });

      if (!user) {
        try {
          user = await this.prisma.user.create({
            data: {
              clerkId: lookupId,
              email: email || `${lookupId}@google.local`,
              name,
            },
            select: SAFE_USER_SELECT,
          });
        } catch (createErr: any) {
          // Race condition: another request created the user between findFirst and create.
          // Retry the lookup once — the row now exists.
          if (createErr?.code === 'P2002') {
            user = await this.prisma.user.findFirst({
              where: { OR: [{ clerkId: lookupId }, { email: email || '' }] },
              select: SAFE_USER_SELECT,
            });
            if (!user) throw createErr;
          } else {
            throw createErr;
          }
        }
      } else if (user.clerkId !== lookupId) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { clerkId: lookupId, name },
          select: SAFE_USER_SELECT,
        });
      }

      request.user = user;
      return true;
    } catch (error) {
      console.error('[Guard] DB error:', error?.message);
      throw new UnauthorizedException('Server error');
    }
  }
}
