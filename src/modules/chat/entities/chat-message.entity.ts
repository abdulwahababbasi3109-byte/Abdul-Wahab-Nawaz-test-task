import { QuotaSource } from '@prisma/client';
import { TokenUsage } from './ai-completion.entity';

export class ChatMessageEntity {
  constructor(
    readonly id: string,
    readonly userId: string,
    readonly question: string,
    readonly answer: string,
    readonly model: string,
    readonly usage: TokenUsage,
    readonly quotaSource: QuotaSource,
    readonly bundleId: string | null,
    readonly createdAt: Date,
  ) {}
}
