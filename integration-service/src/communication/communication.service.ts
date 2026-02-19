import { BadRequestException, Injectable } from '@nestjs/common';
import { GmailCommunicationProvider } from './providers/gmail-communication.provider';
import { CommunicationProvider } from './providers/communication-provider.interface';

@Injectable()
export class CommunicationService {
  constructor(private readonly gmailProvider: GmailCommunicationProvider) {}

  private resolveProvider(provider: string): CommunicationProvider {
    if (provider.toLowerCase() === 'gmail') {
      return this.gmailProvider;
    }

    throw new BadRequestException(
      `Unsupported communication provider '${provider}'. Supported providers: gmail`,
    );
  }

  listThreads(provider: string, query?: string, maxResults?: number, token?: string) {
    return this.resolveProvider(provider).listThreads(query, maxResults, token);
  }

  getThread(provider: string, threadId: string, token?: string) {
    return this.resolveProvider(provider).getThread(threadId, token);
  }

  searchMessages(provider: string, query: string, maxResults?: number, token?: string) {
    return this.resolveProvider(provider).searchMessages(query, maxResults, token);
  }

  getMessage(provider: string, messageId: string, token?: string) {
    return this.resolveProvider(provider).getMessage(messageId, token);
  }

  sendMessage(
    provider: string,
    input: { to: string; subject: string; body: string; threadId?: string },
    token?: string,
  ) {
    return this.resolveProvider(provider).sendMessage(input, token);
  }
}
