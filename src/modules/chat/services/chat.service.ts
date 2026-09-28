import { Injectable } from '@nestjs/common';
import { QuotaSource } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { ChatMessagesRepository } from '../repositories/chat-messages.repository';
import { ChatMessageEntity } from '../entities/chat-message.entity';
import { OpenAiMockService } from './openai-mock.service';
import { QuotaService } from './quota.service';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quotaService: QuotaService,
    private readonly openAi: OpenAiMockService,
    private readonly chatMessagesRepository: ChatMessagesRepository,
  ) {}

  async ask(userId: string, question: string): Promise<ChatMessageEntity> {
    const now = new Date();
    await this.quotaService.assertHasQuota(userId, now);

    const completion = await this.openAi.createChatCompletion(question);

    return this.prisma.$transaction(async (tx) => {
      const bundleId = await this.quotaService.consume(userId, now, tx);
      return this.chatMessagesRepository.create(
        {
          userId,
          question,
          answer: completion.answer,
          model: completion.model,
          usage: completion.usage,
          quotaSource: bundleId ? QuotaSource.BUNDLE : QuotaSource.FREE,
          bundleId,
        },
        tx,
      );
    });
  }
}
