import { Module } from '@nestjs/common';
import { SubscriptionsController } from './controllers/subscriptions.controller';
import { SubscriptionsRepository } from './repositories/subscriptions.repository';
import { BillingService } from './services/billing.service';
import { BundleUsageService } from './services/bundle-usage.service';
import { PaymentService } from './services/payment.service';
import { SubscriptionsService } from './services/subscriptions.service';

@Module({
  controllers: [SubscriptionsController],
  providers: [
    SubscriptionsRepository,
    PaymentService,
    SubscriptionsService,
    BillingService,
    BundleUsageService,
  ],
  exports: [BundleUsageService],
})
export class SubscriptionsModule {}
