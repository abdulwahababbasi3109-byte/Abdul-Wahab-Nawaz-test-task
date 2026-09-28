import { Injectable } from '@nestjs/common';
import { BundleStatus } from '@prisma/client';
import { SubscriptionsRepository } from '../repositories/subscriptions.repository';
import { CreateSubscriptionDto } from '../dto/create-subscription.dto';
import {
  PaymentFailedError,
  SubscriptionNotActiveError,
  SubscriptionNotFoundError,
} from '../errors/subscription.errors';
import { cycleEnd, PLANS, priceFor } from '../entities/plans';
import { SubscriptionEntity } from '../entities/subscription.entity';
import { PaymentService } from './payment.service';

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly subscriptionsRepository: SubscriptionsRepository,
    private readonly paymentService: PaymentService,
  ) {}

  async create(
    userId: string,
    dto: CreateSubscriptionDto,
  ): Promise<SubscriptionEntity> {
    const price = priceFor(dto.tier, dto.billingCycle);
    if (!this.paymentService.charge(price)) {
      throw new PaymentFailedError(price);
    }

    const startDate = new Date();
    return this.subscriptionsRepository.create({
      userId,
      tier: dto.tier,
      billingCycle: dto.billingCycle,
      price,
      maxMessages: PLANS[dto.tier].maxMessages,
      autoRenew: dto.autoRenew ?? true,
      startDate,
      endDate: cycleEnd(startDate, dto.billingCycle),
    });
  }

  async setAutoRenew(
    userId: string,
    id: string,
    autoRenew: boolean,
  ): Promise<SubscriptionEntity> {
    const sub = await this.getActive(userId, id);
    return this.subscriptionsRepository.update(sub.id, {
      autoRenew,
      renewalDate: autoRenew ? sub.endDate : null,
    });
  }

  async cancel(userId: string, id: string): Promise<SubscriptionEntity> {
    const sub = await this.getActive(userId, id);
    const now = new Date();
    return this.subscriptionsRepository.update(sub.id, {
      status: BundleStatus.CANCELLED,
      autoRenew: false,
      endDate: now,
      renewalDate: null,
      cancelledAt: now,
    });
  }

  private async getActive(
    userId: string,
    id: string,
  ): Promise<SubscriptionEntity> {
    const sub = await this.subscriptionsRepository.findById(id);
    if (!sub || sub.userId !== userId) {
      throw new SubscriptionNotFoundError(id);
    }
    if (sub.status !== BundleStatus.ACTIVE) {
      throw new SubscriptionNotActiveError(sub.id, sub.status);
    }
    return sub;
  }
}
