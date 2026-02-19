import { BadRequestException, Injectable } from '@nestjs/common';
import { ListIssuesDto } from './dto/list-issues.dto';
import { ListProjectsDto } from './dto/list-projects.dto';
import { ListUsersDto } from './dto/list-users.dto';
import { RawQueryDto } from './dto/raw-query.dto';
import { LinearProjectManagerProvider } from './providers/linear-project-manager.provider';
import { ProjectManagerProvider } from './providers/project-manager-provider.interface';

@Injectable()
export class ProjectManagerService {
  constructor(private readonly linearProvider: LinearProjectManagerProvider) {}

  private resolveProvider(provider: string): ProjectManagerProvider {
    if (provider.toLowerCase() === 'linear') {
      return this.linearProvider;
    }

    throw new BadRequestException(
      `Unsupported provider '${provider}'. Supported providers: linear`,
    );
  }

  getProviderHealth(provider: string, token?: string) {
    return this.resolveProvider(provider).health(token);
  }

  getViewer(provider: string, token?: string) {
    return this.resolveProvider(provider).getViewer(token);
  }

  listTeams(provider: string, first?: number, token?: string) {
    return this.resolveProvider(provider).listTeams(first, token);
  }

  listUsers(provider: string, dto: ListUsersDto, token?: string) {
    return this.resolveProvider(provider).listUsers(dto, token);
  }

  listProjects(provider: string, dto: ListProjectsDto, token?: string) {
    return this.resolveProvider(provider).listProjects(dto, token);
  }

  getProject(provider: string, projectId: string, token?: string) {
    return this.resolveProvider(provider).getProject(projectId, token);
  }

  createProject(provider: string, input: Record<string, unknown>, token?: string) {
    return this.resolveProvider(provider).createProject(input, token);
  }

  updateProject(provider: string, projectId: string, input: Record<string, unknown>, token?: string) {
    return this.resolveProvider(provider).updateProject(projectId, input, token);
  }

  listIssues(provider: string, dto: ListIssuesDto, token?: string) {
    return this.resolveProvider(provider).listIssues(dto, token);
  }

  getIssue(provider: string, issueId: string, token?: string) {
    return this.resolveProvider(provider).getIssue(issueId, token);
  }

  createIssue(provider: string, input: Record<string, unknown>, token?: string) {
    return this.resolveProvider(provider).createIssue(input, token);
  }

  updateIssue(provider: string, issueId: string, input: Record<string, unknown>, token?: string) {
    return this.resolveProvider(provider).updateIssue(issueId, input, token);
  }

  createComment(provider: string, issueId: string, body: string, token?: string) {
    return this.resolveProvider(provider).createComment(issueId, body, token);
  }

  listCycles(provider: string, teamId: string, first?: number, token?: string) {
    return this.resolveProvider(provider).listCycles(teamId, first, token);
  }

  rawQuery(provider: string, dto: RawQueryDto, token?: string) {
    return this.resolveProvider(provider).rawQuery(dto, token);
  }

  async getSyncSummary(
    provider: string,
    dto: ListIssuesDto & { staleHours?: number },
    token?: string,
  ) {
    const staleHours = dto.staleHours ?? 72;
    const staleCutoffMs = Date.now() - staleHours * 60 * 60 * 1000;

    const payload = await this.resolveProvider(provider).listIssues(dto, token);
    const nodes =
      (payload as { issues?: { nodes?: Array<Record<string, unknown>> } }).issues?.nodes ?? [];

    const summary = {
      total: nodes.length,
      blocked: 0,
      overdue: 0,
      stale: 0,
      completionPct: 0,
    };

    for (const issue of nodes) {
      const state = (issue.state as Record<string, unknown> | undefined) ?? {};
      const stateName = String(state.name ?? '').toLowerCase();
      const stateType = String(state.type ?? '').toLowerCase();
      const dueDate = issue.dueDate ? new Date(String(issue.dueDate)) : null;
      const updatedAt = issue.updatedAt ? new Date(String(issue.updatedAt)) : null;

      if (stateName.includes('block')) {
        summary.blocked += 1;
      }

      if (dueDate && !Number.isNaN(dueDate.getTime()) && dueDate.getTime() < Date.now()) {
        summary.overdue += 1;
      }

      if (updatedAt && !Number.isNaN(updatedAt.getTime()) && updatedAt.getTime() < staleCutoffMs) {
        summary.stale += 1;
      }

      if (stateType === 'completed' || stateType === 'done' || stateName === 'done') {
        summary.completionPct += 1;
      }
    }

    summary.completionPct = summary.total > 0 ? Math.round((summary.completionPct / summary.total) * 100) : 0;
    return summary;
  }

  async sendSlackDigest(
    provider: string,
    dto: ListIssuesDto & { staleHours?: number; webhookUrl: string; title?: string },
    token?: string,
  ) {
    if (!dto.webhookUrl) {
      throw new BadRequestException('webhookUrl is required');
    }

    const summary = await this.getSyncSummary(provider, dto, token);
    const title = dto.title || 'AgentPM Sprint Digest';
    const text =
      `*${title}*\n` +
      `• Total issues: ${summary.total}\n` +
      `• Blocked: ${summary.blocked}\n` +
      `• Overdue: ${summary.overdue}\n` +
      `• Stale: ${summary.stale}\n` +
      `• Completion: ${summary.completionPct}%`;

    const response = await fetch(dto.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      throw new BadRequestException(`Slack webhook failed with status ${response.status}`);
    }

    return { sent: true, summary };
  }
}
