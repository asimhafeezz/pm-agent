import { Module } from '@nestjs/common';
import { CommunicationController } from './communication.controller';
import { CommunicationService } from './communication.service';
import { GmailCommunicationProvider } from './providers/gmail-communication.provider';

@Module({
  controllers: [CommunicationController],
  providers: [CommunicationService, GmailCommunicationProvider],
})
export class CommunicationModule {}
