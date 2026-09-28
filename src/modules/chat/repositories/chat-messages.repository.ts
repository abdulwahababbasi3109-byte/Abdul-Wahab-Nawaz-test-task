import { Injectable } from '@nestjs/common';
import { ChatMessage, Prisma, QuotaSource } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { TokenUsage } from '../entities/ai-completion.entity';
import { ChatMessageEntity } from '../entities/chat-message.entity';

export interface CreateChatMessageData {
  userId: string;
  question: string;
  answer: string;
  model: string;
  usage: TokenUsage;
  quotaSource: QuotaSource;
  bundleId: string | null;
}

@Injectable()
export class ChatMessagesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    data: CreateChatMessageData,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<ChatMessageEntity> {
    const row = await tx.chatMessage.create({
      data: {
        userId: data.userId,
        question: data.question,
        answer: data.answer,
        model: data.model,
        promptTokens: data.usage.promptTokens,
        completionTokens: data.usage.completionTokens,
        totalTokens: data.usage.totalTokens,
        quotaSource: data.quotaSource,
        bundleId: data.bundleId,
      },
    });
    return this.toEntity(row);
  }

  private toEntity(row: ChatMessage): ChatMessageEntity {
    return new ChatMessageEntity(
      row.id,
      row.userId,
      row.question,
      row.answer,
      row.model,
      {
        promptTokens: row.promptTokens,
        completionTokens: row.completionTokens,
        totalTokens: row.totalTokens,
      },
      row.quotaSource,
      row.bundleId,
      row.createdAt,
    );
  }
}
