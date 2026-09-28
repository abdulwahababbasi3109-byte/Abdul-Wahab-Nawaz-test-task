import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { setTimeout as sleep } from 'timers/promises';
import { AiCompletion } from '../entities/ai-completion.entity';

const MOCK_MODEL = 'gpt-4o-mini';
const CHARS_PER_TOKEN = 4;

const MOCK_ANSWERS = [
  'That is a great question. Based on the information available, the short answer is that it depends on your specific context, but here are the key considerations to keep in mind.',
  'Here is a concise explanation: break the problem into smaller parts, validate each assumption, and iterate on the solution until it meets your requirements.',
  'There are several approaches you could take. The most common one is to start simple, measure the results, and then optimize where it matters most.',
  'In summary, the recommended approach balances correctness, readability, and performance. Let me know if you would like a more detailed walkthrough.',
];

@Injectable()
export class OpenAiMockService {
  private readonly minDelayMs: number;
  private readonly maxDelayMs: number;

  constructor(config: ConfigService) {
    this.minDelayMs = Number(config.get('OPENAI_MOCK_MIN_DELAY_MS', 500));
    this.maxDelayMs = Number(config.get('OPENAI_MOCK_MAX_DELAY_MS', 1500));
  }

  async createChatCompletion(question: string): Promise<AiCompletion> {
    await sleep(this.randomDelay());

    const answer =
      MOCK_ANSWERS[Math.floor(Math.random() * MOCK_ANSWERS.length)];
    const promptTokens = this.estimateTokens(question);
    const completionTokens = this.estimateTokens(answer);

    return {
      id: `chatcmpl-${randomUUID()}`,
      model: MOCK_MODEL,
      answer,
      finishReason: 'stop',
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
    };
  }

  private randomDelay(): number {
    const span = Math.max(this.maxDelayMs - this.minDelayMs, 0);
    return this.minDelayMs + Math.floor(Math.random() * (span + 1));
  }

  private estimateTokens(text: string): number {
    return Math.max(1, Math.ceil(text.length / CHARS_PER_TOKEN));
  }
}
