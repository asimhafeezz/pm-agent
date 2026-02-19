import { ListIssuesDto } from '../dto/list-issues.dto';
import { ListProjectsDto } from '../dto/list-projects.dto';
import { ListUsersDto } from '../dto/list-users.dto';
import { RawQueryDto } from '../dto/raw-query.dto';

export interface ProjectManagerProvider {
  health(token?: string): Promise<unknown>;
  getViewer(token?: string): Promise<unknown>;
  listTeams(first?: number, token?: string): Promise<unknown>;
  listUsers(dto: ListUsersDto, token?: string): Promise<unknown>;
  listProjects(dto: ListProjectsDto, token?: string): Promise<unknown>;
  getProject(projectId: string, token?: string): Promise<unknown>;
  createProject(input: Record<string, unknown>, token?: string): Promise<unknown>;
  updateProject(projectId: string, input: Record<string, unknown>, token?: string): Promise<unknown>;
  listIssues(dto: ListIssuesDto, token?: string): Promise<unknown>;
  getIssue(issueId: string, token?: string): Promise<unknown>;
  createIssue(input: Record<string, unknown>, token?: string): Promise<unknown>;
  updateIssue(issueId: string, input: Record<string, unknown>, token?: string): Promise<unknown>;
  createComment(issueId: string, body: string, token?: string): Promise<unknown>;
  listCycles(teamId: string, first?: number, token?: string): Promise<unknown>;
  rawQuery(dto: RawQueryDto, token?: string): Promise<unknown>;
}
