import { BillingCycle, BundleTier } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';

export class CreateSubscriptionDto {
  @IsEnum(BundleTier)
  tier!: BundleTier;

  @IsEnum(BillingCycle)
  billingCycle!: BillingCycle;

  @IsOptional()
  @IsBoolean()
  autoRenew?: boolean;
}
