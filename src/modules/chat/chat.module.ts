import { Module } from '@nestjs/common';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { ChatController } from './controllers/chat.controller';
import { ChatMessagesRepository } from './repositories/chat-messages.repository';
import { MonthlyUsageRepository } from './repositories/monthly-usage.repository';
import { ChatService } from './services/chat.service';
import { OpenAiMockService } from './services/openai-mock.service';
import { QuotaService } from './services/quota.service';

@Module({
  imports: [SubscriptionsModule],
  controllers: [ChatController],
  providers: [
    ChatMessagesRepository,
    MonthlyUsageRepository,
    OpenAiMockService,
    QuotaService,
    ChatService,
  ],
})
export class ChatModule {}
