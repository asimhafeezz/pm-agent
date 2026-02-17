import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { UpdateMemoryDto } from './dto/update-memory.dto';
import { ConversationsService } from './conversations.service';
import { MessagesService } from '../messages/messages.service';
import { CreateMessageDto } from '../messages/dto/create-message.dto';

@Controller('conversations')
@UseGuards(AuthGuard)
export class ConversationsController {
  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly messagesService: MessagesService,
  ) {}

  @Post()
  async createConversation(
    @CurrentUser() user: { id: string },
    @Body() payload: CreateConversationDto,
  ) {
    return this.conversationsService.create(user.id, payload);
  }

  @Get()
  async listConversations(@CurrentUser() user: { id: string }) {
    return this.conversationsService.list(user.id);
  }

  @Patch(':conversationId')
  async updateConversation(
    @CurrentUser() user: { id: string },
    @Param('conversationId') conversationId: string,
    @Body() payload: UpdateConversationDto,
  ) {
    return this.conversationsService.update(user.id, conversationId, payload);
  }

  @Delete(':conversationId')
  async deleteConversation(
    @CurrentUser() user: { id: string },
    @Param('conversationId') conversationId: string,
  ) {
    return this.conversationsService.remove(user.id, conversationId);
  }

  @Get(':conversationId/messages')
  async listMessages(@CurrentUser() user: { id: string }, @Param('conversationId') conversationId: string) {
    return this.messagesService.list(user.id, conversationId);
  }

  @Post(':conversationId/messages')
  async createMessage(
    @CurrentUser() user: { id: string },
    @Param('conversationId') conversationId: string,
    @Body() payload: CreateMessageDto,
  ) {
    return this.messagesService.create(user.id, conversationId, payload);
  }

  @Get(':conversationId/memory')
  async getMemory(@CurrentUser() user: { id: string }, @Param('conversationId') conversationId: string) {
    return this.conversationsService.getMemory(user.id, conversationId);
  }

  @Post(':conversationId/memory')
  async upsertMemory(
    @CurrentUser() user: { id: string },
    @Param('conversationId') conversationId: string,
    @Body() payload: UpdateMemoryDto,
  ) {
    return this.conversationsService.upsertMemory(user.id, conversationId, payload);
  }
}
