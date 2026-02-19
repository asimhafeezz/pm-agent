export interface CommunicationProvider {
  listThreads(query?: string, maxResults?: number, token?: string): Promise<unknown>;
  getThread(threadId: string, token?: string): Promise<unknown>;
  searchMessages(query: string, maxResults?: number, token?: string): Promise<unknown>;
  getMessage(messageId: string, token?: string): Promise<unknown>;
  sendMessage(
    input: { to: string; subject: string; body: string; threadId?: string },
    token?: string,
  ): Promise<unknown>;
}
