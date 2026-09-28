import { HttpStatus } from '@nestjs/common';
import { DomainError } from '../../../common/errors/domain.error';

export class SubscriptionNotFoundError extends DomainError {
  constructor(subscriptionId: string) {
    super(
      HttpStatus.NOT_FOUND,
      'SUBSCRIPTION_NOT_FOUND',
      'Subscription not found',
      { subscriptionId },
    );
  }
}

export class SubscriptionNotActiveError extends DomainError {
  constructor(subscriptionId: string, status: string) {
    super(
      HttpStatus.CONFLICT,
      'SUBSCRIPTION_NOT_ACTIVE',
      'Only active subscriptions can be changed',
      { subscriptionId, status },
    );
  }
}

export class PaymentFailedError extends DomainError {
  constructor(amount: number) {
    super(
      HttpStatus.PAYMENT_REQUIRED,
      'PAYMENT_FAILED',
      'Payment was declined, subscription was not created',
      { amount },
    );
  }
}
