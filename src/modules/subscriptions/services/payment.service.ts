import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PaymentService {
  private readonly failureRate: number;

  constructor(config: ConfigService) {
    this.failureRate = Number(config.get('PAYMENT_FAILURE_RATE', 0.2));
  }

  charge(amount: number): boolean {
    return amount >= 0 && Math.random() >= this.failureRate;
  }
}
