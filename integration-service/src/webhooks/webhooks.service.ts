import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface NormalizedActivityEvent {
  source: string;
  eventType: string;
  externalId: string;
  title: string;
  summary: string;
  payload: Record<string, unknown>;
  occurredAt: string;
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(private readonly configService: ConfigService) {}

  verifyLinearSignature(rawBody: Buffer, signature: string): boolean {
    const secret = this.configService.get<string>('LINEAR_WEBHOOK_SIGNING_SECRET');
    if (!secret) {
      this.logger.warn('LINEAR_WEBHOOK_SIGNING_SECRET is not configured, skipping signature verification');
      return true;
    }

    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(rawBody);
    const expectedSignature = hmac.digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature, 'utf-8'),
      Buffer.from(expectedSignature, 'utf-8'),
    );
  }

  normalizeLinearEvent(body: Record<string, unknown>): NormalizedActivityEvent | null {
    const action = String(body.action || '');
    const type = String(body.type || '');
    const data = (body.data || {}) as Record<string, unknown>;

    if (type === 'Issue') {
      return this.normalizeLinearIssueEvent(action, data);
    }

    if (type === 'Comment') {
      return this.normalizeLinearCommentEvent(action, data);
    }

    if (type === 'Project') {
      return this.normalizeLinearProjectEvent(action, data);
    }

    this.logger.debug(`Ignoring Linear webhook type=${type} action=${action}`);
    return null;
  }

  private normalizeLinearIssueEvent(
    action: string,
    data: Record<string, unknown>,
  ): NormalizedActivityEvent {
    const identifier = String(data.identifier || data.id || '');
    const title = String(data.title || '');
    const state = (data.state as Record<string, unknown>) || {};
    const assignee = (data.assignee as Record<string, unknown>) || {};
    const stateName = String(state.name || '');
    const assigneeName = String(assignee.name || '');

    let eventType: string;
    let summary: string;

    switch (action) {
      case 'create':
        eventType = 'issue_created';
        summary = `Issue ${identifier} created: "${title}"${assigneeName ? ` (assigned to ${assigneeName})` : ''}`;
        break;
      case 'update':
        eventType = 'issue_updated';
        summary = `Issue ${identifier} updated: "${title}"${stateName ? ` → ${stateName}` : ''}`;
        break;
      case 'remove':
        eventType = 'issue_deleted';
        summary = `Issue ${identifier} deleted: "${title}"`;
        break;
      default:
        eventType = `issue_${action}`;
        summary = `Issue ${identifier}: ${action}`;
    }

    return {
      source: 'linear',
      eventType,
      externalId: String(data.id || ''),
      title: `${identifier} ${title}`,
      summary,
      payload: data,
      occurredAt: String(data.updatedAt || data.createdAt || new Date().toISOString()),
    };
  }

  private normalizeLinearCommentEvent(
    action: string,
    data: Record<string, unknown>,
  ): NormalizedActivityEvent {
    const issue = (data.issue as Record<string, unknown>) || {};
    const user = (data.user as Record<string, unknown>) || {};
    const issueIdentifier = String(issue.identifier || '');
    const userName = String(user.name || 'Someone');
    const bodyText = String(data.body || '').slice(0, 100);

    return {
      source: 'linear',
      eventType: action === 'create' ? 'comment_added' : `comment_${action}`,
      externalId: String(data.id || ''),
      title: `Comment on ${issueIdentifier}`,
      summary: `${userName} commented on ${issueIdentifier}: "${bodyText}${bodyText.length >= 100 ? '...' : ''}"`,
      payload: data,
      occurredAt: String(data.updatedAt || data.createdAt || new Date().toISOString()),
    };
  }

  // --- Slack Event Handling ---

  async handleSlackEvent(event: Record<string, unknown>): Promise<void> {
    const type = String(event.type || '');
    this.logger.log(`Processing Slack event: type=${type}`);

    // Handle DM messages (standup responses sent via DM to the bot)
    if (type === 'message' && !event.bot_id && event.channel_type === 'im') {
      await this.forwardStandupResponse({
        respondent: String(event.user || ''),
        rawText: String(event.text || ''),
        source: 'slack',
        slackTs: String(event.ts || ''),
        slackChannel: String(event.channel || ''),
      });
    }
  }

  async handleSlackSlashCommand(body: Record<string, unknown>): Promise<void> {
    const command = String(body.command || '');
    this.logger.log(`Processing Slack slash command: ${command}`);

    // /standup command — submit standup response
    if (command === '/standup') {
      await this.forwardStandupResponse({
        respondent: String(body.user_id || ''),
        respondentName: String(body.user_name || ''),
        rawText: String(body.text || ''),
        source: 'slack',
        slackChannel: String(body.channel_id || ''),
      });
    }
  }

  private async forwardStandupResponse(data: Record<string, unknown>): Promise<void> {
    try {
      const apiUrl = process.env.API_STANDUP_URL || 'http://localhost:6000/api/standups/responses';
      const internalKey = process.env.INTERNAL_API_KEY || 'dev-internal-key';

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-api-key': internalKey,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        this.logger.error(`Failed to forward standup response to API: ${response.status}`);
      }
    } catch (error) {
      this.logger.error(`Failed to forward standup response: ${error}`);
    }
  }

  private normalizeLinearProjectEvent(
    action: string,
    data: Record<string, unknown>,
  ): NormalizedActivityEvent {
    const name = String(data.name || '');

    return {
      source: 'linear',
      eventType: action === 'create' ? 'project_created' : `project_${action}`,
      externalId: String(data.id || ''),
      title: name,
      summary: `Project "${name}" ${action}d`,
      payload: data,
      occurredAt: String(data.updatedAt || data.createdAt || new Date().toISOString()),
    };
  }
}
