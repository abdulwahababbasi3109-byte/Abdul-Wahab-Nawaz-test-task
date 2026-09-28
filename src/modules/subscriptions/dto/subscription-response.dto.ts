import { BillingCycle, BundleStatus, BundleTier } from '@prisma/client';
import { SubscriptionEntity } from '../entities/subscription.entity';

export class SubscriptionResponseDto {
  id!: string;
  tier!: BundleTier;
  billingCycle!: BillingCycle;
  price!: number;
  maxMessages!: number | null;
  messagesUsed!: number;
  remaining!: number | null;
  status!: BundleStatus;
  autoRenew!: boolean;
  startDate!: string;
  endDate!: string;
  renewalDate!: string | null;
  cancelledAt!: string | null;

  static fromEntity(sub: SubscriptionEntity): SubscriptionResponseDto {
    return {
      id: sub.id,
      tier: sub.tier,
      billingCycle: sub.billingCycle,
      price: sub.price,
      maxMessages: sub.maxMessages,
      messagesUsed: sub.messagesUsed,
      remaining: sub.remaining,
      status: sub.status,
      autoRenew: sub.autoRenew,
      startDate: sub.startDate.toISOString(),
      endDate: sub.endDate.toISOString(),
      renewalDate: sub.renewalDate?.toISOString() ?? null,
      cancelledAt: sub.cancelledAt?.toISOString() ?? null,
    };
  }
}
