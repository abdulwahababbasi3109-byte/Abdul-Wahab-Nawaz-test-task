import { BillingCycle, BundleTier } from '@prisma/client';
import { addUtcMonths } from '../../../common/utils/date.util';

interface Plan {
  maxMessages: number | null;
  monthlyPrice: number;
  yearlyPrice: number;
}

export const PLANS: Record<BundleTier, Plan> = {
  BASIC: { maxMessages: 10, monthlyPrice: 9.99, yearlyPrice: 99.9 },
  PRO: { maxMessages: 100, monthlyPrice: 29.99, yearlyPrice: 299.9 },
  ENTERPRISE: { maxMessages: null, monthlyPrice: 99.99, yearlyPrice: 999.9 },
};

export function priceFor(tier: BundleTier, cycle: BillingCycle): number {
  const plan = PLANS[tier];
  return cycle === BillingCycle.YEARLY ? plan.yearlyPrice : plan.monthlyPrice;
}

export function cycleEnd(start: Date, cycle: BillingCycle): Date {
  return addUtcMonths(start, cycle === BillingCycle.YEARLY ? 12 : 1);
}
