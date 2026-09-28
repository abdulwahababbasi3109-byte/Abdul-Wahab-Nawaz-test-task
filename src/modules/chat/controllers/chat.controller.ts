import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentUserId } from '../../../common/decorators/current-user-id.decorator';
import { UserIdentityGuard } from '../../../common/guards/user-identity.guard';
import { AskQuestionDto } from '../dto/ask-question.dto';
import { ChatMessageResponseDto } from '../dto/chat-message-response.dto';
import { ChatService } from '../services/chat.service';

@Controller('chat')
@UseGuards(UserIdentityGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('messages')
  async ask(
    @CurrentUserId() userId: string,
    @Body() dto: AskQuestionDto,
  ): Promise<ChatMessageResponseDto> {
    const message = await this.chatService.ask(userId, dto.question);
    return ChatMessageResponseDto.fromEntity(message);
  }
}
