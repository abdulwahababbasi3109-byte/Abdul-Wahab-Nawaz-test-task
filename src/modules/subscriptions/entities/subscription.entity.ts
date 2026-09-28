import { BillingCycle, BundleStatus, BundleTier } from '@prisma/client';

export class SubscriptionEntity {
  constructor(
    readonly id: string,
    readonly userId: string,
    readonly tier: BundleTier,
    readonly billingCycle: BillingCycle,
    readonly price: number,
    readonly maxMessages: number | null,
    readonly messagesUsed: number,
    readonly status: BundleStatus,
    readonly autoRenew: boolean,
    readonly startDate: Date,
    readonly endDate: Date,
    readonly renewalDate: Date | null,
    readonly cancelledAt: Date | null,
    readonly createdAt: Date,
  ) {}

  get remaining(): number | null {
    if (this.maxMessages === null) {
      return null;
    }
    return Math.max(this.maxMessages - this.messagesUsed, 0);
  }
}
