import { Injectable } from '@nestjs/common';
import {
  BillingCycle,
  BundleStatus,
  BundleTier,
  Prisma,
  SubscriptionBundle,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { SubscriptionEntity } from '../entities/subscription.entity';

export interface CreateSubscriptionData {
  userId: string;
  tier: BundleTier;
  billingCycle: BillingCycle;
  price: number;
  maxMessages: number | null;
  autoRenew: boolean;
  startDate: Date;
  endDate: Date;
}

type Db = Prisma.TransactionClient;

@Injectable()
export class SubscriptionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateSubscriptionData): Promise<SubscriptionEntity> {
    const row = await this.prisma.subscriptionBundle.create({
      data: { ...data, renewalDate: data.autoRenew ? data.endDate : null },
    });
    return toEntity(row);
  }

  async findById(id: string): Promise<SubscriptionEntity | null> {
    const row = await this.prisma.subscriptionBundle.findUnique({
      where: { id },
    });
    return row ? toEntity(row) : null;
  }

  async update(
    id: string,
    data: Prisma.SubscriptionBundleUpdateInput,
  ): Promise<SubscriptionEntity> {
    const row = await this.prisma.subscriptionBundle.update({
      where: { id },
      data,
    });
    return toEntity(row);
  }

  async findDueForBilling(now: Date): Promise<SubscriptionEntity[]> {
    const rows = await this.prisma.subscriptionBundle.findMany({
      where: { status: BundleStatus.ACTIVE, endDate: { lte: now } },
    });
    return rows.map(toEntity);
  }

  async updateIfStillDue(
    sub: SubscriptionEntity,
    data: Prisma.SubscriptionBundleUpdateManyMutationInput,
  ): Promise<boolean> {
    const { count } = await this.prisma.subscriptionBundle.updateMany({
      where: { id: sub.id, status: BundleStatus.ACTIVE, endDate: sub.endDate },
      data,
    });
    return count === 1;
  }

  async findLatestUsable(
    userId: string,
    now: Date,
    db: Db = this.prisma,
  ): Promise<SubscriptionEntity | null> {
    const row = await db.subscriptionBundle.findFirst({
      where: {
        userId,
        status: BundleStatus.ACTIVE,
        startDate: { lte: now },
        endDate: { gt: now },
        OR: [
          { maxMessages: null },
          {
            messagesUsed: {
              lt: this.prisma.subscriptionBundle.fields.maxMessages,
            },
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
    return row ? toEntity(row) : null;
  }

  async incrementUsage(id: string, db: Db): Promise<void> {
    await db.subscriptionBundle.update({
      where: { id },
      data: { messagesUsed: { increment: 1 } },
    });
  }
}

function toEntity(row: SubscriptionBundle): SubscriptionEntity {
  return new SubscriptionEntity(
    row.id,
    row.userId,
    row.tier,
    row.billingCycle,
    row.price.toNumber(),
    row.maxMessages,
    row.messagesUsed,
    row.status,
    row.autoRenew,
    row.startDate,
    row.endDate,
    row.renewalDate,
    row.cancelledAt,
    row.createdAt,
  );
}
