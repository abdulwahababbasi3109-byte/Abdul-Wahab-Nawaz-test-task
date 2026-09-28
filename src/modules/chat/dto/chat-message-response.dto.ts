import { QuotaSource } from '@prisma/client';
import { TokenUsage } from '../entities/ai-completion.entity';
import { ChatMessageEntity } from '../entities/chat-message.entity';

export class ChatMessageResponseDto {
  id!: string;
  question!: string;
  answer!: string;
  model!: string;
  usage!: TokenUsage;
  quotaSource!: QuotaSource;
  bundleId!: string | null;
  createdAt!: string;

  static fromEntity(message: ChatMessageEntity): ChatMessageResponseDto {
    return {
      id: message.id,
      question: message.question,
      answer: message.answer,
      model: message.model,
      usage: message.usage,
      quotaSource: message.quotaSource,
      bundleId: message.bundleId,
      createdAt: message.createdAt.toISOString(),
    };
  }
}
