import { BillingCycle, BundleStatus, BundleTier } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { addUtcMonths } from '../src/common/utils/date.util';
import { BillingService } from '../src/modules/subscriptions/services/billing.service';
import {
  createBundle,
  createTestApp,
  createUser,
  DAY,
  resetDatabase,
  TestContext,
} from './helpers';

describe('Subscriptions module', () => {
  let ctx: TestContext;
  let http: App;
  let userId: string;

  const create = (id: string, body: unknown) =>
    request(http)
      .post('/api/v1/subscriptions')
      .set('x-user-id', id)
      .send(body as object);

  const setAutoRenew = (id: string, subId: string, body: unknown) =>
    request(http)
      .patch(`/api/v1/subscriptions/${subId}/auto-renew`)
      .set('x-user-id', id)
      .send(body as object);

  const cancel = (id: string, subId: string) =>
    request(http)
      .post(`/api/v1/subscriptions/${subId}/cancel`)
      .set('x-user-id', id);

  const findBundle = (id: string) =>
    ctx.prisma.subscriptionBundle.findUniqueOrThrow({ where: { id } });

  beforeAll(async () => {
    ctx = await createTestApp();
    http = ctx.app.getHttpServer() as App;
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    userId = await createUser(ctx.prisma);
    ctx.payment.charge.mockReset().mockReturnValue(true);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  describe('create', () => {
    it.each([
      [BundleTier.BASIC, BillingCycle.MONTHLY, 10, 9.99, 1],
      [BundleTier.PRO, BillingCycle.MONTHLY, 100, 29.99, 1],
      [BundleTier.ENTERPRISE, BillingCycle.MONTHLY, null, 99.99, 1],
      [BundleTier.BASIC, BillingCycle.YEARLY, 10, 99.9, 12],
      [BundleTier.PRO, BillingCycle.YEARLY, 100, 299.9, 12],
      [BundleTier.ENTERPRISE, BillingCycle.YEARLY, null, 999.9, 12],
    ])(
      'creates %s %s with the right limits, price and dates',
      async (tier, billingCycle, maxMessages, price, months) => {
        const res = await create(userId, { tier, billingCycle }).expect(201);
        const startDate = new Date(res.body.startDate);

        expect(res.body).toMatchObject({
          tier,
          billingCycle,
          maxMessages,
          price,
          status: BundleStatus.ACTIVE,
          autoRenew: true,
          messagesUsed: 0,
          cancelledAt: null,
        });
        expect(res.body.endDate).toBe(
          addUtcMonths(startDate, months).toISOString(),
        );
        expect(res.body.renewalDate).toBe(res.body.endDate);
        expect(ctx.payment.charge).toHaveBeenCalledWith(price);

        const stored = await findBundle(res.body.id);
        expect(stored.userId).toBe(userId);
        expect(stored.price.toNumber()).toBe(price);
      },
    );

    it('has no renewal date when auto-renew is off', async () => {
      const res = await create(userId, {
        tier: BundleTier.BASIC,
        billingCycle: BillingCycle.MONTHLY,
        autoRenew: false,
      }).expect(201);
      expect(res.body.autoRenew).toBe(false);
      expect(res.body.renewalDate).toBeNull();
    });

    it('allows multiple active bundles for one user', async () => {
      await create(userId, { tier: 'BASIC', billingCycle: 'MONTHLY' }).expect(
        201,
      );
      await create(userId, { tier: 'PRO', billingCycle: 'YEARLY' }).expect(201);
      expect(
        await ctx.prisma.subscriptionBundle.count({
          where: { userId, status: BundleStatus.ACTIVE },
        }),
      ).toBe(2);
    });

    it('returns 402 and saves nothing when the payment fails', async () => {
      ctx.payment.charge.mockReturnValue(false);
      const res = await create(userId, {
        tier: 'PRO',
        billingCycle: 'MONTHLY',
      }).expect(402);
      expect(res.body.error.code).toBe('PAYMENT_FAILED');
      expect(await ctx.prisma.subscriptionBundle.count()).toBe(0);
    });

    it.each([
      ['unknown tier', { tier: 'GOLD', billingCycle: 'MONTHLY' }],
      ['unknown billing cycle', { tier: 'BASIC', billingCycle: 'WEEKLY' }],
      ['missing tier', { billingCycle: 'MONTHLY' }],
      ['missing billing cycle', { tier: 'BASIC' }],
      [
        'non boolean autoRenew',
        { tier: 'BASIC', billingCycle: 'MONTHLY', autoRenew: 'yes' },
      ],
      [
        'client supplied price',
        { tier: 'BASIC', billingCycle: 'MONTHLY', price: 0 },
      ],
    ])('rejects %s', async (_name, body) => {
      const res = await create(userId, body).expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(ctx.payment.charge).not.toHaveBeenCalled();
    });

    it('requires a user', async () => {
      await request(http)
        .post('/api/v1/subscriptions')
        .send({ tier: 'BASIC', billingCycle: 'MONTHLY' })
        .expect(401);
    });
  });

  describe('toggle auto-renew', () => {
    it('turns auto-renew off and on again', async () => {
      const bundle = await createBundle(ctx.prisma, userId, {
        autoRenew: true,
      });

      const off = await setAutoRenew(userId, bundle.id, {
        autoRenew: false,
      }).expect(200);
      expect(off.body.autoRenew).toBe(false);
      expect(off.body.renewalDate).toBeNull();

      const on = await setAutoRenew(userId, bundle.id, {
        autoRenew: true,
      }).expect(200);
      expect(on.body.autoRenew).toBe(true);
      expect(on.body.renewalDate).toBe(bundle.endDate.toISOString());
    });

    it("returns 404 for another user's subscription", async () => {
      const otherUser = await createUser(ctx.prisma);
      const bundle = await createBundle(ctx.prisma, otherUser);
      const res = await setAutoRenew(userId, bundle.id, {
        autoRenew: false,
      }).expect(404);
      expect(res.body.error.code).toBe('SUBSCRIPTION_NOT_FOUND');
      expect((await findBundle(bundle.id)).autoRenew).toBe(true);
    });

    it('returns 404 for a subscription that does not exist', async () => {
      await setAutoRenew(userId, '00000000-0000-4000-8000-000000000000', {
        autoRenew: false,
      }).expect(404);
    });

    it('returns 400 for an invalid id or body', async () => {
      await setAutoRenew(userId, 'not-a-uuid', { autoRenew: false }).expect(
        400,
      );
      const bundle = await createBundle(ctx.prisma, userId);
      await setAutoRenew(userId, bundle.id, {}).expect(400);
      await setAutoRenew(userId, bundle.id, { autoRenew: 'no' }).expect(400);
    });

    it.each([BundleStatus.CANCELLED, BundleStatus.INACTIVE])(
      'returns 409 for a %s subscription',
      async (status) => {
        const bundle = await createBundle(ctx.prisma, userId, { status });
        const res = await setAutoRenew(userId, bundle.id, {
          autoRenew: true,
        }).expect(409);
        expect(res.body.error.code).toBe('SUBSCRIPTION_NOT_ACTIVE');
      },
    );
  });

  describe('cancel', () => {
    it('ends the current billing cycle immediately and prevents renewal', async () => {
      const bundle = await createBundle(ctx.prisma, userId);
      const res = await cancel(userId, bundle.id).expect(200);

      expect(res.body).toMatchObject({
        status: BundleStatus.CANCELLED,
        autoRenew: false,
        renewalDate: null,
      });
      expect(res.body.cancelledAt).not.toBeNull();
      expect(res.body.endDate).toBe(res.body.cancelledAt);
      expect(new Date(res.body.endDate).getTime()).toBeLessThan(
        bundle.endDate.getTime(),
      );
    });

    it('cannot be used for chat after cancelling', async () => {
      const bundle = await createBundle(ctx.prisma, userId);
      await cancel(userId, bundle.id).expect(200);
      for (let i = 0; i < 3; i++) {
        await request(http)
          .post('/api/v1/chat/messages')
          .set('x-user-id', userId)
          .send({ question: 'hi' })
          .expect(201);
      }
      const res = await request(http)
        .post('/api/v1/chat/messages')
        .set('x-user-id', userId)
        .send({ question: 'hi' })
        .expect(402);
      expect(res.body.error.code).toBe('QUOTA_EXCEEDED');
    });

    it('preserves usage history', async () => {
      const bundle = await createBundle(ctx.prisma, userId, {
        messagesUsed: 4,
      });
      await ctx.prisma.chatMessage.create({
        data: {
          userId,
          question: 'q',
          answer: 'a',
          model: 'gpt-4o-mini',
          promptTokens: 1,
          completionTokens: 1,
          totalTokens: 2,
          quotaSource: 'BUNDLE',
          bundleId: bundle.id,
        },
      });

      await cancel(userId, bundle.id).expect(200);

      expect((await findBundle(bundle.id)).messagesUsed).toBe(4);
      expect(
        await ctx.prisma.chatMessage.count({ where: { bundleId: bundle.id } }),
      ).toBe(1);
    });

    it('returns 409 when cancelling twice', async () => {
      const bundle = await createBundle(ctx.prisma, userId);
      await cancel(userId, bundle.id).expect(200);
      const res = await cancel(userId, bundle.id).expect(409);
      expect(res.body.error.code).toBe('SUBSCRIPTION_NOT_ACTIVE');
    });

    it("returns 404 for another user's subscription", async () => {
      const otherUser = await createUser(ctx.prisma);
      const bundle = await createBundle(ctx.prisma, otherUser);
      await cancel(userId, bundle.id).expect(404);
      expect((await findBundle(bundle.id)).status).toBe(BundleStatus.ACTIVE);
    });

    it('cannot turn auto-renew back on after cancelling', async () => {
      const bundle = await createBundle(ctx.prisma, userId);
      await cancel(userId, bundle.id).expect(200);
      await setAutoRenew(userId, bundle.id, { autoRenew: true }).expect(409);
    });
  });

  describe('billing', () => {
    const runBilling = () =>
      ctx.app.get(BillingService).processDueSubscriptions();

    const dueBundle = (overrides = {}) =>
      createBundle(ctx.prisma, userId, {
        startDate: new Date(Date.now() - 31 * DAY),
        endDate: new Date(Date.now() - 1000),
        messagesUsed: 7,
        ...overrides,
      });

    it('renews a due monthly subscription when payment succeeds', async () => {
      const bundle = await dueBundle();
      await runBilling();

      const renewed = await findBundle(bundle.id);
      const expectedEnd = addUtcMonths(bundle.endDate, 1);
      expect(renewed.status).toBe(BundleStatus.ACTIVE);
      expect(renewed.startDate).toEqual(bundle.endDate);
      expect(renewed.endDate).toEqual(expectedEnd);
      expect(renewed.renewalDate).toEqual(expectedEnd);
      expect(renewed.messagesUsed).toBe(0);
      expect(ctx.payment.charge).toHaveBeenCalledWith(9.99);
    });

    it('renews a yearly subscription for 12 months', async () => {
      const bundle = await dueBundle({
        billingCycle: BillingCycle.YEARLY,
      });
      await runBilling();
      expect((await findBundle(bundle.id)).endDate).toEqual(
        addUtcMonths(bundle.endDate, 12),
      );
    });

    it('marks the subscription inactive when payment fails', async () => {
      ctx.payment.charge.mockReturnValue(false);
      const bundle = await dueBundle();
      await runBilling();

      const failed = await findBundle(bundle.id);
      expect(failed.status).toBe(BundleStatus.INACTIVE);
      expect(failed.autoRenew).toBe(false);
      expect(failed.renewalDate).toBeNull();
      expect(failed.endDate).toEqual(bundle.endDate);
    });

    it('expires a due subscription without auto-renew and does not charge', async () => {
      const bundle = await dueBundle({ autoRenew: false });
      await runBilling();

      expect((await findBundle(bundle.id)).status).toBe(BundleStatus.INACTIVE);
      expect(ctx.payment.charge).not.toHaveBeenCalled();
    });

    it('does not renew a cancelled subscription', async () => {
      const bundle = await dueBundle({
        status: BundleStatus.CANCELLED,
        autoRenew: false,
      });
      await runBilling();

      const after = await findBundle(bundle.id);
      expect(after.status).toBe(BundleStatus.CANCELLED);
      expect(after.endDate).toEqual(bundle.endDate);
      expect(ctx.payment.charge).not.toHaveBeenCalled();
    });

    it('does not touch subscriptions that are not due yet', async () => {
      const bundle = await createBundle(ctx.prisma, userId, {
        messagesUsed: 3,
      });
      await runBilling();

      const after = await findBundle(bundle.id);
      expect(after.endDate).toEqual(bundle.endDate);
      expect(after.messagesUsed).toBe(3);
      expect(ctx.payment.charge).not.toHaveBeenCalled();
    });

    it('keeps processing other subscriptions when one payment fails', async () => {
      ctx.payment.charge.mockReturnValueOnce(false).mockReturnValueOnce(true);
      const first = await dueBundle();
      const second = await dueBundle();
      await runBilling();

      const statuses = [
        (await findBundle(first.id)).status,
        (await findBundle(second.id)).status,
      ].sort();
      expect(statuses).toEqual([BundleStatus.ACTIVE, BundleStatus.INACTIVE]);
    });
  });

  describe('billing cycle dates', () => {
    it.each([
      ['2026-01-31T10:00:00.000Z', 1, '2026-02-28T10:00:00.000Z'],
      ['2028-01-31T10:00:00.000Z', 1, '2028-02-29T10:00:00.000Z'],
      ['2026-12-15T10:00:00.000Z', 1, '2027-01-15T10:00:00.000Z'],
      ['2028-02-29T10:00:00.000Z', 12, '2029-02-28T10:00:00.000Z'],
    ])('%s + %i month(s) = %s', (start, months, expected) => {
      expect(addUtcMonths(new Date(start), months).toISOString()).toBe(
        expected,
      );
    });
  });
});
