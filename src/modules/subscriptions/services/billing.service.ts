import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BundleStatus } from '@prisma/client';
import { SubscriptionsRepository } from '../repositories/subscriptions.repository';
import { cycleEnd } from '../entities/plans';
import { SubscriptionEntity } from '../entities/subscription.entity';
import { PaymentService } from './payment.service';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly subscriptionsRepository: SubscriptionsRepository,
    private readonly paymentService: PaymentService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async processDueSubscriptions(now = new Date()): Promise<void> {
    const due = await this.subscriptionsRepository.findDueForBilling(now);
    for (const sub of due) {
      try {
        await this.process(sub);
      } catch (error) {
        this.logger.error(`Billing failed for subscription ${sub.id}`, error);
      }
    }
  }

  private async process(sub: SubscriptionEntity): Promise<void> {
    if (!sub.autoRenew) {
      await this.subscriptionsRepository.updateIfStillDue(sub, {
        status: BundleStatus.INACTIVE,
        renewalDate: null,
      });
      this.logger.log(`Subscription ${sub.id} expired`);
      return;
    }

    if (!this.paymentService.charge(sub.price)) {
      await this.subscriptionsRepository.updateIfStillDue(sub, {
        status: BundleStatus.INACTIVE,
        autoRenew: false,
        renewalDate: null,
      });
      this.logger.warn(`Payment failed for subscription ${sub.id}`);
      return;
    }

    const newEnd = cycleEnd(sub.endDate, sub.billingCycle);
    await this.subscriptionsRepository.updateIfStillDue(sub, {
      startDate: sub.endDate,
      endDate: newEnd,
      renewalDate: newEnd,
      messagesUsed: 0,
    });
    this.logger.log(
      `Subscription ${sub.id} renewed until ${newEnd.toISOString()}`,
    );
  }
}
