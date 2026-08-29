import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { MessagesService } from './messages.service';
import { RolesGuard } from '../auth/roles.guard';
import { AuthedRequest } from '../auth/authed-request';
import { EmptyToUndefined, ToOptionalNumber } from '../common/transforms';

class CreateConversationDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;
}

class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content!: string;
}

class GetMessagesQueryDto {
  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  before?: string;

  @IsOptional()
  @ToOptionalNumber()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

/**
 * Bare `/messages`, no `@Roles(...)` — deliberate exception to §5's
 * role-prefixed default. The resource (a conversation) is the same shape for
 * every role; ownership is re-derived per request from `req.user.userId`
 * inside the service, never from a body id. See CLAUDE.md §5.
 */
@Controller('messages')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class MessagesController {
  constructor(private messagesService: MessagesService) {}

  @Get('contacts')
  getContacts(@Req() req: AuthedRequest) {
    return this.messagesService.getContacts(req.user.userId, req.user.role);
  }

  @Get('conversations')
  getConversations(@Req() req: AuthedRequest) {
    return this.messagesService.getConversations(req.user.userId);
  }

  @Post('conversations')
  createConversation(
    @Req() req: AuthedRequest,
    @Body() dto: CreateConversationDto,
  ) {
    return this.messagesService.findOrCreateConversation(
      req.user.userId,
      req.user.role,
      dto.userId,
    );
  }

  @Get('conversations/:id')
  getMessages(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Query() query: GetMessagesQueryDto,
  ) {
    return this.messagesService.getMessages(
      req.user.userId,
      id,
      query.before,
      query.limit,
    );
  }

  @Post('conversations/:id')
  sendMessage(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.messagesService.sendMessage(req.user.userId, id, dto.content);
  }
}
