import { Injectable } from '@nestjs/common';
import { LinearService } from '../../main-services/linear/linear.service';
import { ListIssuesDto } from '../dto/list-issues.dto';
import { ListProjectsDto } from '../dto/list-projects.dto';
import { ListUsersDto } from '../dto/list-users.dto';
import { RawQueryDto } from '../dto/raw-query.dto';
import { ProjectManagerProvider } from './project-manager-provider.interface';

@Injectable()
export class LinearProjectManagerProvider implements ProjectManagerProvider {
  constructor(private readonly linearService: LinearService) {}

  health(token?: string) {
    return this.linearService.getViewer(token);
  }

  getViewer(token?: string) {
    return this.linearService.getViewer(token);
  }

  listTeams(first?: number, token?: string) {
    return this.linearService.listTeams(first, token);
  }

  listUsers(dto: ListUsersDto, token?: string) {
    return this.linearService.listUsers(dto.first, dto.query, token);
  }

  listProjects(dto: ListProjectsDto, token?: string) {
    return this.linearService.listProjects(dto, token);
  }

  getProject(projectId: string, token?: string) {
    return this.linearService.getProject(projectId, token);
  }

  createProject(input: Record<string, unknown>, token?: string) {
    return this.linearService.createProject(input, token);
  }

  updateProject(projectId: string, input: Record<string, unknown>, token?: string) {
    return this.linearService.updateProject(projectId, input, token);
  }

  listIssues(dto: ListIssuesDto, token?: string) {
    return this.linearService.listIssues(dto, token);
  }

  getIssue(issueId: string, token?: string) {
    return this.linearService.getIssue(issueId, token);
  }

  createIssue(input: Record<string, unknown>, token?: string) {
    return this.linearService.createIssue(input, token);
  }

  updateIssue(issueId: string, input: Record<string, unknown>, token?: string) {
    return this.linearService.updateIssue(issueId, input, token);
  }

  createComment(issueId: string, body: string, token?: string) {
    return this.linearService.createComment(issueId, body, token);
  }

  listCycles(teamId: string, first?: number, token?: string) {
    return this.linearService.listCycles(teamId, first, token);
  }

  rawQuery(dto: RawQueryDto, token?: string) {
    return this.linearService.rawQuery(dto.query, dto.variables, token);
  }
}
