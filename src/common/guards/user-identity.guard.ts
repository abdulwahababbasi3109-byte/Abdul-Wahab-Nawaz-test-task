import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { DomainError } from '../errors/domain.error';

export interface RequestWithUser extends Request {
  userId: string;
}

@Injectable()
export class UserIdentityGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const userId = request.header('x-user-id');

    if (!userId || !isUUID(userId)) {
      throw new DomainError(
        HttpStatus.UNAUTHORIZED,
        'MISSING_USER_ID',
        'A valid x-user-id header is required',
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new DomainError(
        HttpStatus.NOT_FOUND,
        'USER_NOT_FOUND',
        'User not found',
        { userId },
      );
    }

    request.userId = user.id;
    return true;
  }
}
