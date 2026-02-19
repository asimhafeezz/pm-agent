import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LinearModule } from './main-services/linear/linear.module';
import { NotionModule } from './main-services/notion/notion.module';
import { GoogleDocsModule } from './main-services/google-docs/google-docs.module';
import { GmailModule } from './main-services/gmail/gmail.module';
import { SlackModule } from './main-services/slack/slack.module';
import { ProjectManagerModule } from './project-manager/project-manager.module';
import { DocumentSourcesModule } from './document-sources/document-sources.module';
import { CommunicationModule } from './communication/communication.module';
import { OAuthModule } from './oauth/oauth.module';
import { WebhooksModule } from './webhooks/webhooks.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    LinearModule,
    NotionModule,
    GoogleDocsModule,
    GmailModule,
    SlackModule,
    ProjectManagerModule,
    DocumentSourcesModule,
    CommunicationModule,
    OAuthModule,
    WebhooksModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
