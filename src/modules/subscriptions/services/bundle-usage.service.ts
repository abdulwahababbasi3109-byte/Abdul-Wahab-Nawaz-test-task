import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SubscriptionsRepository } from '../repositories/subscriptions.repository';

@Injectable()
export class BundleUsageService {
  constructor(
    private readonly subscriptionsRepository: SubscriptionsRepository,
  ) {}

  async hasUsableBundle(userId: string, now: Date): Promise<boolean> {
    return (
      (await this.subscriptionsRepository.findLatestUsable(userId, now)) !==
      null
    );
  }

  async useMessage(
    userId: string,
    now: Date,
    tx: Prisma.TransactionClient,
  ): Promise<string | null> {
    const bundle = await this.subscriptionsRepository.findLatestUsable(
      userId,
      now,
      tx,
    );
    if (!bundle) {
      return null;
    }
    await this.subscriptionsRepository.incrementUsage(bundle.id, tx);
    return bundle.id;
  }
}
