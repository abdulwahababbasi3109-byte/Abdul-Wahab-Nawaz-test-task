import { HttpStatus } from '@nestjs/common';
import { DomainError } from '../../../common/errors/domain.error';

export class QuotaExceededError extends DomainError {
  constructor(freeLimit: number, freeResetsAt: Date) {
    super(
      HttpStatus.PAYMENT_REQUIRED,
      'QUOTA_EXCEEDED',
      'You have used all free messages this month and have no active bundle with messages left',
      { freeLimit, freeResetsAt: freeResetsAt.toISOString() },
    );
  }
}
