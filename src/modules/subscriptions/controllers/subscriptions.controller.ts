import {
  Body,
  Controller,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUserId } from '../../../common/decorators/current-user-id.decorator';
import { UserIdentityGuard } from '../../../common/guards/user-identity.guard';
import { CreateSubscriptionDto } from '../dto/create-subscription.dto';
import { SubscriptionResponseDto } from '../dto/subscription-response.dto';
import { UpdateAutoRenewDto } from '../dto/update-auto-renew.dto';
import { SubscriptionsService } from '../services/subscriptions.service';

@Controller('subscriptions')
@UseGuards(UserIdentityGuard)
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Post()
  async create(
    @CurrentUserId() userId: string,
    @Body() dto: CreateSubscriptionDto,
  ): Promise<SubscriptionResponseDto> {
    const sub = await this.subscriptionsService.create(userId, dto);
    return SubscriptionResponseDto.fromEntity(sub);
  }

  @Patch(':id/auto-renew')
  async setAutoRenew(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAutoRenewDto,
  ): Promise<SubscriptionResponseDto> {
    const sub = await this.subscriptionsService.setAutoRenew(
      userId,
      id,
      dto.autoRenew,
    );
    return SubscriptionResponseDto.fromEntity(sub);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  async cancel(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SubscriptionResponseDto> {
    const sub = await this.subscriptionsService.cancel(userId, id);
    return SubscriptionResponseDto.fromEntity(sub);
  }
}
