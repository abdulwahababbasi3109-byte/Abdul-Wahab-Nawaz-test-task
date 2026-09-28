import { BundleStatus, BundleTier, QuotaSource } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { OpenAiMockService } from '../src/modules/chat/services/openai-mock.service';
import {
  createBundle,
  createTestApp,
  createUser,
  DAY,
  resetDatabase,
  TestContext,
} from './helpers';

describe('Chat module', () => {
  let ctx: TestContext;
  let http: App;
  let userId: string;

  const ask = (id: string, body: unknown = { question: 'What is DDD?' }) =>
    request(http)
      .post('/api/v1/chat/messages')
      .set('x-user-id', id)
      .send(body as object);

  const usePreviousFreeMessages = async (id: string): Promise<void> => {
    for (let i = 0; i < 3; i++) {
      await ask(id).expect(201);
    }
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    http = ctx.app.getHttpServer() as App;
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    userId = await createUser(ctx.prisma);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  describe('user identification', () => {
    it('rejects a request without x-user-id', async () => {
      const res = await request(http)
        .post('/api/v1/chat/messages')
        .send({ question: 'hi' })
        .expect(401);
      expect(res.body.error.code).toBe('MISSING_USER_ID');
    });

    it('rejects an x-user-id that is not a uuid', async () => {
      const res = await ask('123').expect(401);
      expect(res.body.error.code).toBe('MISSING_USER_ID');
    });

    it('rejects an unknown user', async () => {
      const res = await ask('00000000-0000-4000-8000-000000000000').expect(404);
      expect(res.body.error.code).toBe('USER_NOT_FOUND');
    });
  });

  describe('validation', () => {
    it.each([
      ['missing question', {}],
      ['empty question', { question: '' }],
      ['whitespace only question', { question: '   ' }],
      ['non string question', { question: 123 }],
      ['too long question', { question: 'a'.repeat(4001) }],
      ['user id in body', { question: 'hi', userId: 'abc' }],
    ])('rejects %s', async (_name, body) => {
      const res = await ask(userId, body).expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details.errors.length).toBeGreaterThan(0);
    });

    it('does not use quota for an invalid request', async () => {
      await ask(userId, { question: '' }).expect(400);
      expect(await ctx.prisma.monthlyUsage.count()).toBe(0);
    });
  });

  describe('asking a question', () => {
    it('returns a mocked OpenAI answer and stores question, answer and tokens', async () => {
      const res = await ask(userId, { question: '  What is DDD?  ' }).expect(
        201,
      );

      expect(res.body).toMatchObject({
        question: 'What is DDD?',
        model: 'gpt-4o-mini',
        quotaSource: QuotaSource.FREE,
        bundleId: null,
      });
      expect(res.body.answer.length).toBeGreaterThan(0);
      expect(res.body.usage.totalTokens).toBe(
        res.body.usage.promptTokens + res.body.usage.completionTokens,
      );

      const stored = await ctx.prisma.chatMessage.findUniqueOrThrow({
        where: { id: res.body.id },
      });
      expect(stored).toMatchObject({
        userId,
        question: 'What is DDD?',
        answer: res.body.answer,
        promptTokens: res.body.usage.promptTokens,
        completionTokens: res.body.usage.completionTokens,
        totalTokens: res.body.usage.totalTokens,
      });
    });

    it('simulates the OpenAI response delay', async () => {
      const started = Date.now();
      await ask(userId).expect(201);
      expect(Date.now() - started).toBeGreaterThanOrEqual(100);
    });
  });

  describe('free monthly quota', () => {
    it('allows 3 free messages then returns a structured quota error', async () => {
      await usePreviousFreeMessages(userId);

      const res = await ask(userId).expect(402);
      expect(res.body.statusCode).toBe(402);
      expect(res.body.error.code).toBe('QUOTA_EXCEEDED');
      expect(res.body.error.details.freeLimit).toBe(3);

      const now = new Date();
      const nextMonth = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
      );
      expect(res.body.error.details.freeResetsAt).toBe(nextMonth.toISOString());

      expect(await ctx.prisma.chatMessage.count({ where: { userId } })).toBe(3);
      const usage = await ctx.prisma.monthlyUsage.findFirstOrThrow({
        where: { userId },
      });
      expect(usage.freeMessagesUsed).toBe(3);
    });

    it('does not call OpenAI when the user has no quota', async () => {
      await usePreviousFreeMessages(userId);
      const spy = jest.spyOn(
        ctx.app.get(OpenAiMockService),
        'createChatCompletion',
      );
      await ask(userId).expect(402);
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('resets on the 1st of each month because usage is tracked per month', async () => {
      const now = new Date();
      const lastMonth = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
      );
      await ctx.prisma.monthlyUsage.create({
        data: { userId, period: lastMonth, freeMessagesUsed: 3 },
      });

      const res = await ask(userId).expect(201);
      expect(res.body.quotaSource).toBe(QuotaSource.FREE);
      expect(await ctx.prisma.monthlyUsage.count({ where: { userId } })).toBe(
        2,
      );
    });

    it('tracks usage separately for each user', async () => {
      const otherUser = await createUser(ctx.prisma);
      await usePreviousFreeMessages(userId);
      await ask(otherUser).expect(201);
    });
  });

  describe('subscription bundles', () => {
    it('uses a bundle after the free quota is used', async () => {
      const bundle = await createBundle(ctx.prisma, userId);
      await usePreviousFreeMessages(userId);

      const res = await ask(userId).expect(201);
      expect(res.body.quotaSource).toBe(QuotaSource.BUNDLE);
      expect(res.body.bundleId).toBe(bundle.id);

      const updated = await ctx.prisma.subscriptionBundle.findUniqueOrThrow({
        where: { id: bundle.id },
      });
      expect(updated.messagesUsed).toBe(1);
    });

    it('uses free messages before bundle messages', async () => {
      const bundle = await createBundle(ctx.prisma, userId);
      const res = await ask(userId).expect(201);
      expect(res.body.quotaSource).toBe(QuotaSource.FREE);
      const unchanged = await ctx.prisma.subscriptionBundle.findUniqueOrThrow({
        where: { id: bundle.id },
      });
      expect(unchanged.messagesUsed).toBe(0);
    });

    it('deducts from the latest bundle with remaining quota, then falls back to older ones', async () => {
      const older = await createBundle(ctx.prisma, userId, {
        createdAt: new Date(Date.now() - 2 * DAY),
      });
      const latest = await createBundle(ctx.prisma, userId, {
        tier: BundleTier.PRO,
        maxMessages: 100,
        messagesUsed: 99,
        createdAt: new Date(Date.now() - DAY),
      });
      await usePreviousFreeMessages(userId);

      expect((await ask(userId).expect(201)).body.bundleId).toBe(latest.id);
      expect((await ask(userId).expect(201)).body.bundleId).toBe(older.id);
    });

    it('supports multiple active bundles and returns 402 when all are used up', async () => {
      await createBundle(ctx.prisma, userId, { messagesUsed: 9 });
      await createBundle(ctx.prisma, userId, { messagesUsed: 9 });
      await usePreviousFreeMessages(userId);

      await ask(userId).expect(201);
      await ask(userId).expect(201);
      const res = await ask(userId).expect(402);
      expect(res.body.error.code).toBe('QUOTA_EXCEEDED');
    });

    it('treats Enterprise bundles as unlimited', async () => {
      const bundle = await createBundle(ctx.prisma, userId, {
        tier: BundleTier.ENTERPRISE,
        maxMessages: null,
        messagesUsed: 100000,
      });
      await usePreviousFreeMessages(userId);

      const res = await ask(userId).expect(201);
      expect(res.body.bundleId).toBe(bundle.id);
    });

    it.each([
      ['expired', { endDate: new Date(Date.now() - 1000) }],
      ['inactive', { status: BundleStatus.INACTIVE }],
      ['cancelled', { status: BundleStatus.CANCELLED }],
      ['fully used', { messagesUsed: 10 }],
      ['not started yet', { startDate: new Date(Date.now() + DAY) }],
    ])('ignores a bundle that is %s', async (_name, overrides) => {
      await createBundle(ctx.prisma, userId, overrides);
      await usePreviousFreeMessages(userId);
      await ask(userId).expect(402);
    });

    it("ignores another user's bundle", async () => {
      const otherUser = await createUser(ctx.prisma);
      await createBundle(ctx.prisma, otherUser);
      await usePreviousFreeMessages(userId);
      await ask(userId).expect(402);
    });
  });

  describe('reliability', () => {
    it('never goes over quota with concurrent requests', async () => {
      const bundle = await createBundle(ctx.prisma, userId);

      const responses = await Promise.all(
        Array.from({ length: 20 }, () => ask(userId)),
      );
      const statuses = responses.map((res) => res.status);

      expect(statuses.filter((s) => s === 201)).toHaveLength(13);
      expect(statuses.filter((s) => s === 402)).toHaveLength(7);

      const usage = await ctx.prisma.monthlyUsage.findFirstOrThrow({
        where: { userId },
      });
      const updated = await ctx.prisma.subscriptionBundle.findUniqueOrThrow({
        where: { id: bundle.id },
      });
      expect(usage.freeMessagesUsed).toBe(3);
      expect(updated.messagesUsed).toBe(10);
      expect(await ctx.prisma.chatMessage.count({ where: { userId } })).toBe(
        13,
      );
    });

    it('does not use quota when the OpenAI call fails', async () => {
      const spy = jest
        .spyOn(ctx.app.get(OpenAiMockService), 'createChatCompletion')
        .mockRejectedValueOnce(new Error('OpenAI is down'));

      const res = await ask(userId).expect(500);
      expect(res.body.error.code).toBe('INTERNAL_SERVER_ERROR');
      expect(await ctx.prisma.chatMessage.count()).toBe(0);
      const usage = await ctx.prisma.monthlyUsage.findFirst({
        where: { userId },
      });
      expect(usage?.freeMessagesUsed ?? 0).toBe(0);
      spy.mockRestore();
    });
  });
});
