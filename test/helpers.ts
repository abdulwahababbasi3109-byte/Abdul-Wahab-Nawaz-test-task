import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  BillingCycle,
  BundleStatus,
  BundleTier,
  SubscriptionBundle,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/main';
import { PaymentService } from '../src/modules/subscriptions/services/payment.service';
import { PrismaService } from '../src/prisma/prisma.service';

export const DAY = 24 * 60 * 60 * 1000;

export interface TestContext {
  app: INestApplication;
  prisma: PrismaService;
  payment: { charge: jest.Mock<boolean, [number]> };
}

export async function createTestApp(): Promise<TestContext> {
  const payment = { charge: jest.fn<boolean, [number]>(() => true) };
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PaymentService)
    .useValue(payment)
    .compile();

  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app);
  await app.listen(0);

  return { app, prisma: app.get(PrismaService), payment };
}

export async function resetDatabase(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE chat_messages, monthly_usages, subscription_bundles, users CASCADE',
  );
}

export async function createUser(prisma: PrismaService): Promise<string> {
  const user = await prisma.user.create({
    data: { email: `${randomUUID()}@test.com`, name: 'Test User' },
  });
  return user.id;
}

export async function createBundle(
  prisma: PrismaService,
  userId: string,
  overrides: Partial<SubscriptionBundle> = {},
): Promise<SubscriptionBundle> {
  const now = Date.now();
  return prisma.subscriptionBundle.create({
    data: {
      userId,
      tier: BundleTier.BASIC,
      billingCycle: BillingCycle.MONTHLY,
      price: 9.99,
      maxMessages: 10,
      status: BundleStatus.ACTIVE,
      startDate: new Date(now - DAY),
      endDate: new Date(now + 29 * DAY),
      ...overrides,
    },
  });
}
