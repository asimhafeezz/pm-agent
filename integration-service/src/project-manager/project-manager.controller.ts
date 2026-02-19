import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreateIssueDto } from './dto/create-issue.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { ListIssuesDto } from './dto/list-issues.dto';
import { ListProjectsDto } from './dto/list-projects.dto';
import { ListUsersDto } from './dto/list-users.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { RawQueryDto } from './dto/raw-query.dto';
import { UpdateIssueDto } from './dto/update-issue.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectManagerService } from './project-manager.service';

@Controller('project-manager')
export class ProjectManagerController {
  constructor(private readonly projectManagerService: ProjectManagerService) {}

  @Get(':provider/health')
  providerHealth(
    @Param('provider') provider: string,
    @Headers('x-provider-token') providerToken?: string,
  ) {
    return this.projectManagerService.getProviderHealth(provider, providerToken);
  }

  @Get(':provider/viewer')
  viewer(
    @Param('provider') provider: string,
    @Headers('x-provider-token') providerToken?: string,
  ) {
    return this.projectManagerService.getViewer(provider, providerToken);
  }

  @Get(':provider/teams')
  listTeams(
    @Param('provider') provider: string,
    @Query() query: PaginationQueryDto,
    @Headers('x-provider-token') providerToken?: string,
  ) {
    return this.projectManagerService.listTeams(provider, query.first, providerToken);
  }

  @Get(':provider/users')
  listUsers(
    @Param('provider') provider: string,
    @Query() query: ListUsersDto,
    @Headers('x-provider-token') providerToken?: string,
  ) {
    return this.projectManagerService.listUsers(provider, query, providerToken);
  }

  @Get(':provider/projects')
  listProjects(
    @Param('provider') provider: string,
    @Query() query: ListProjectsDto,
    @Headers('x-provider-token') providerToken?: string,
  ) {
    return this.projectManagerService.listProjects(provider, query, providerToken);
  }

  @Get(':provider/projects/:projectId')
  getProject(
    @Param('provider') provider: string,
    @Param('projectId') projectId: string,
    @Headers('x-provider-token') providerToken?: string,
  ) {
    return this.projectManagerService.getProject(provider, projectId, providerToken);
  }

  @Post(':provider/projects')
  createProject(
    @Param('provider') provider: string,
    @Body() body: CreateProjectDto,
    @Headers('x-provider-token') providerToken?: string,
  ) {
    return this.projectManagerService.createProject(provider, body.input, providerToken);
  }

  @Patch(':provider/projects/:projectId')
  updateProject(
    @Param('provider') provider: string,
    @Param('projectId') projectId: string,
    @Body() body: UpdateProjectDto,
    @Headers('x-provider-token') providerToken?: string,
  ) {
    return this.projectManagerService.updateProject(provider, projectId, body.input, providerToken);
  }

  @Get(':provider/issues')
  listIssues(
    @Param('provider') provider: string,
    @Query() query: ListIssuesDto,
    @Headers('x-provider-token') providerToken?: string,
  ) {
    return this.projectManagerService.listIssues(provider, query, providerToken);
  }

  @Get(':provider/issues/:issueId')
  getIssue(
    @Param('provider') provider: string,
    @Param('issueId') issueId: string,
    @Headers('x-provider-token') providerToken?: string,
  ) {
    return this.projectManagerService.getIssue(provider, issueId, providerToken);
  }

  @Post(':provider/issues')
  createIssue(
    @Param('provider') provider: string,
    @Body() body: CreateIssueDto,
    @Headers('x-provider-token') providerToken?: string,
  ) {
    return this.projectManagerService.createIssue(provider, body.input, providerToken);
  }

  @Patch(':provider/issues/:issueId')
  updateIssue(
    @Param('provider') provider: string,
    @Param('issueId') issueId: string,
    @Body() body: UpdateIssueDto,
    @Headers('x-provider-token') providerToken?: string,
  ) {
    return this.projectManagerService.updateIssue(provider, issueId, body.input, providerToken);
  }

  @Post(':provider/issues/:issueId/comments')
  createComment(
    @Param('provider') provider: string,
    @Param('issueId') issueId: string,
    @Body() body: CreateCommentDto,
    @Headers('x-provider-token') providerToken?: string,
  ) {
    return this.projectManagerService.createComment(provider, issueId, body.body, providerToken);
  }

  @Get(':provider/teams/:teamId/cycles')
  listCycles(
    @Param('provider') provider: string,
    @Param('teamId') teamId: string,
    @Query() query: PaginationQueryDto,
    @Headers('x-provider-token') providerToken?: string,
  ) {
    return this.projectManagerService.listCycles(provider, teamId, query.first, providerToken);
  }

  @Post(':provider/query')
  rawQuery(
    @Param('provider') provider: string,
    @Body() body: RawQueryDto,
    @Headers('x-provider-token') providerToken?: string,
  ) {
    return this.projectManagerService.rawQuery(provider, body, providerToken);
  }

  @Get(':provider/sync-summary')
  syncSummary(
    @Param('provider') provider: string,
    @Query() query: ListIssuesDto & { staleHours?: number },
    @Headers('x-provider-token') providerToken?: string,
  ) {
    return this.projectManagerService.getSyncSummary(provider, query, providerToken);
  }

  @Post(':provider/notify/slack')
  notifySlack(
    @Param('provider') provider: string,
    @Body()
    body: ListIssuesDto & { staleHours?: number; webhookUrl: string; title?: string },
    @Headers('x-provider-token') providerToken?: string,
  ) {
    return this.projectManagerService.sendSlackDigest(provider, body, providerToken);
  }
}
