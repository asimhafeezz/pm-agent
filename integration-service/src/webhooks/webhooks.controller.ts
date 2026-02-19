import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Logger,
  Post,
  Res,
  RawBody,
} from '@nestjs/common';
import { Response } from 'express';
import { WebhooksService, NormalizedActivityEvent } from './webhooks.service';

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('linear')
  async handleLinearWebhook(
    @Body() body: Record<string, unknown>,
    @Headers('linear-signature') signature?: string,
  ) {
    this.logger.log(`Received Linear webhook: type=${body.type} action=${body.action}`);

    const event = this.webhooksService.normalizeLinearEvent(body);
    if (!event) {
      return { received: true, processed: false, reason: 'unsupported event type' };
    }

    // Forward to API's activity stream ingestion endpoint
    // The API will persist and broadcast via WebSocket
    try {
      const apiUrl = process.env.API_ACTIVITY_URL || 'http://localhost:6000/api/activity';
      const internalKey = process.env.INTERNAL_API_KEY || 'dev-internal-key';

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-api-key': internalKey,
        },
        body: JSON.stringify(event),
      });

      if (!response.ok) {
        this.logger.error(`Failed to forward activity event to API: ${response.status}`);
      }
    } catch (error) {
      this.logger.error(`Failed to forward activity event to API: ${error}`);
    }

    return { received: true, processed: true, eventType: event.eventType };
  }

  @Post('slack')
  async handleSlackWebhook(
    @Body() body: Record<string, unknown>,
    @Res() res: Response,
  ) {
    // Handle Slack URL verification challenge
    if (body.type === 'url_verification') {
      return res.json({ challenge: body.challenge });
    }

    this.logger.log(`Received Slack webhook: type=${body.type}`);

    // Handle Slack events (slash commands, interactive messages, event callbacks)
    if (body.type === 'event_callback') {
      const event = body.event as Record<string, unknown> | undefined;
      if (event) {
        await this.webhooksService.handleSlackEvent(event);
      }
    }

    // Handle slash command payloads (standup responses)
    if (body.command) {
      await this.webhooksService.handleSlackSlashCommand(body);
    }

    return res.status(200).json({ ok: true });
  }
}
