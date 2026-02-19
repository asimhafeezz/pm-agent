import { Injectable } from '@nestjs/common';
import { GmailService } from '../../main-services/gmail/gmail.service';
import { CommunicationProvider } from './communication-provider.interface';

@Injectable()
export class GmailCommunicationProvider implements CommunicationProvider {
  constructor(private readonly gmailService: GmailService) {}

  listThreads(query?: string, maxResults?: number, token?: string) {
    return this.gmailService.listThreads(query, maxResults, token);
  }

  getThread(threadId: string, token?: string) {
    return this.gmailService.getThread(threadId, token);
  }

  searchMessages(query: string, maxResults?: number, token?: string) {
    return this.gmailService.searchMessages(query, maxResults, token);
  }

  getMessage(messageId: string, token?: string) {
    return this.gmailService.getMessage(messageId, token);
  }

  sendMessage(
    input: { to: string; subject: string; body: string; threadId?: string },
    token?: string,
  ) {
    return this.gmailService.sendMessage(input, token);
  }
}
