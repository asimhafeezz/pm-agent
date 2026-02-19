import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { CommunicationService } from './communication.service';
import { ListThreadsDto } from './dto/list-threads.dto';
import { SearchMessagesDto } from './dto/search-messages.dto';
import { SendMessageDto } from './dto/send-message.dto';

@Controller('communication')
export class CommunicationController {
  constructor(private readonly communicationService: CommunicationService) {}

  @Get(':provider/threads')
  listThreads(
    @Param('provider') provider: string,
    @Query() query: ListThreadsDto,
    @Headers('x-provider-token') providerToken?: string,
  ) {
    return this.communicationService.listThreads(
      provider,
      query.query,
      query.maxResults,
      providerToken,
    );
  }

  @Get(':provider/threads/:threadId')
  getThread(
    @Param('provider') provider: string,
    @Param('threadId') threadId: string,
    @Headers('x-provider-token') providerToken?: string,
  ) {
    return this.communicationService.getThread(provider, threadId, providerToken);
  }

  @Get(':provider/search')
  searchMessages(
    @Param('provider') provider: string,
    @Query() query: SearchMessagesDto,
    @Headers('x-provider-token') providerToken?: string,
  ) {
    return this.communicationService.searchMessages(
      provider,
      query.query,
      query.maxResults,
      providerToken,
    );
  }

  @Get(':provider/messages/:messageId')
  getMessage(
    @Param('provider') provider: string,
    @Param('messageId') messageId: string,
    @Headers('x-provider-token') providerToken?: string,
  ) {
    return this.communicationService.getMessage(provider, messageId, providerToken);
  }

  @Post(':provider/messages')
  sendMessage(
    @Param('provider') provider: string,
    @Body() body: SendMessageDto,
    @Headers('x-provider-token') providerToken?: string,
  ) {
    return this.communicationService.sendMessage(provider, body, providerToken);
  }
}
