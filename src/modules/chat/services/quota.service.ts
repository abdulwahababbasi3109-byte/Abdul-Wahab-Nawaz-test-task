import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import {
  startOfNextUtcMonth,
  startOfUtcMonth,
} from '../../../common/utils/date.util';
import { BundleUsageService } from '../../subscriptions/services/bundle-usage.service';
import { MonthlyUsageRepository } from '../repositories/monthly-usage.repository';
import { QuotaExceededError } from '../errors/chat.errors';

@Injectable()
export class QuotaService {
  private readonly freeLimit: number;

  constructor(
    private readonly monthlyUsageRepository: MonthlyUsageRepository,
    private readonly bundleUsageService: BundleUsageService,
    config: ConfigService,
  ) {
    this.freeLimit = Number(config.get('FREE_MESSAGES_PER_MONTH', 3));
  }

  async assertHasQuota(userId: string, now: Date): Promise<void> {
    const used = await this.monthlyUsageRepository.getUsed(
      userId,
      startOfUtcMonth(now),
    );
    if (used < this.freeLimit) {
      return;
    }
    if (!(await this.bundleUsageService.hasUsableBundle(userId, now))) {
      throw this.quotaExceeded(now);
    }
  }

  async consume(
    userId: string,
    now: Date,
    tx: Prisma.TransactionClient,
  ): Promise<string | null> {
    const period = startOfUtcMonth(now);
    const used = await this.monthlyUsageRepository.lockForUpdate(
      userId,
      period,
      tx,
    );

    if (used < this.freeLimit) {
      await this.monthlyUsageRepository.increment(userId, period, tx);
      return null;
    }

    const bundleId = await this.bundleUsageService.useMessage(userId, now, tx);
    if (!bundleId) {
      throw this.quotaExceeded(now);
    }
    return bundleId;
  }

  private quotaExceeded(now: Date): QuotaExceededError {
    return new QuotaExceededError(this.freeLimit, startOfNextUtcMonth(now));
  }
}
