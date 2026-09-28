import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class MonthlyUsageRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getUsed(userId: string, period: Date): Promise<number> {
    const row = await this.prisma.monthlyUsage.findUnique({
      where: { userId_period: { userId, period } },
    });
    return row?.freeMessagesUsed ?? 0;
  }

  async lockForUpdate(
    userId: string,
    period: Date,
    tx: Prisma.TransactionClient,
  ): Promise<number> {
    await tx.monthlyUsage.createMany({
      data: [{ userId, period }],
      skipDuplicates: true,
    });
    const rows = await tx.$queryRaw<{ free_messages_used: number }[]>`
      SELECT free_messages_used FROM monthly_usages
      WHERE user_id = ${userId}::uuid AND period = ${period}::date
      FOR UPDATE
    `;
    return rows[0].free_messages_used;
  }

  async increment(
    userId: string,
    period: Date,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await tx.monthlyUsage.update({
      where: { userId_period: { userId, period } },
      data: { freeMessagesUsed: { increment: 1 } },
    });
  }
}
