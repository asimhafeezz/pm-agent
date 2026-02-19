import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface LinearGraphQLError {
  message: string;
  extensions?: Record<string, unknown>;
  path?: Array<string | number>;
}

interface LinearGraphQLResponse<TData> {
  data?: TData;
  errors?: LinearGraphQLError[];
}

@Injectable()
export class LinearService {
  private readonly logger = new Logger(LinearService.name);
  private readonly apiUrl = process.env.LINEAR_API_URL || 'https://api.linear.app/graphql';

  constructor(private readonly configService: ConfigService) {}

  async rawQuery<TData = unknown>(
    query: string,
    variables?: Record<string, unknown>,
    tokenOverride?: string,
  ): Promise<TData> {
    const apiKey = this.getApiKey(tokenOverride);
    if (!apiKey) {
      throw new HttpException(
        'LINEAR_API_KEY is missing. Add it in integration-service/.env',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: apiKey,
      },
      body: JSON.stringify({ query, variables }),
    });

    let payload: LinearGraphQLResponse<TData>;
    try {
      payload = (await response.json()) as LinearGraphQLResponse<TData>;
    } catch {
      throw new HttpException(
        'Invalid response from Linear API',
        HttpStatus.BAD_GATEWAY,
      );
    }

    if (!response.ok) {
      this.logger.error(`Linear API error (${response.status}): ${JSON.stringify(payload.errors)}`);
      throw new HttpException(
        payload.errors?.map((e) => e.message).join('; ') || 'Linear API request failed',
        response.status,
      );
    }

    if (payload.errors?.length) {
      this.logger.error(`Linear GraphQL errors: ${JSON.stringify(payload.errors)}`);
      throw new HttpException(
        payload.errors.map((e) => e.message).join('; '),
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!payload.data) {
      throw new HttpException('Linear API returned empty data', HttpStatus.BAD_GATEWAY);
    }

    return payload.data;
  }

  getAuthorizationUrl(redirectUri: string, state: string) {
    const clientId = this.getOAuthClientId();
    const authorizeUrl = this.getOAuthAuthorizeUrl();
    if (!clientId) {
      throw new HttpException(
        'LINEAR_OAUTH_CLIENT_ID is missing. Add it in integration-service/.env',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!redirectUri?.trim()) {
      throw new HttpException('redirectUri is required for OAuth', HttpStatus.BAD_REQUEST);
    }
    if (!state?.trim()) {
      throw new HttpException('state is required for OAuth', HttpStatus.BAD_REQUEST);
    }

    const url = new URL(authorizeUrl);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('state', state);

    const scopes = this.getOAuthScopes();
    if (scopes) {
      url.searchParams.set('scope', scopes);
    }

    return {
      provider: 'linear',
      authorizationUrl: url.toString(),
    };
  }

  async exchangeAuthorizationCode(code: string, redirectUri: string) {
    const clientId = this.getOAuthClientId();
    const clientSecret = this.getOAuthClientSecret();
    const tokenUrl = this.getOAuthTokenUrl();

    if (!clientId || !clientSecret) {
      throw new HttpException(
        'Linear OAuth is not configured. Missing LINEAR_OAUTH_CLIENT_ID/LINEAR_OAUTH_CLIENT_SECRET',
        HttpStatus.BAD_REQUEST,
      );
    }

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      throw new HttpException(
        String(payload.error_description || payload.error || 'Linear OAuth token exchange failed'),
        HttpStatus.BAD_REQUEST,
      );
    }

    const accessToken = String(payload.access_token || '').trim();
    if (!accessToken) {
      throw new HttpException('Linear OAuth response is missing access_token', HttpStatus.BAD_GATEWAY);
    }

    return {
      provider: 'linear' as const,
      accessToken,
      refreshToken: String(payload.refresh_token || '').trim() || undefined,
      tokenType: String(payload.token_type || '').trim() || undefined,
      scope: String(payload.scope || '').trim() || undefined,
      expiresIn:
        typeof payload.expires_in === 'number'
          ? payload.expires_in
          : Number.parseInt(String(payload.expires_in || ''), 10) || undefined,
      raw: payload,
    };
  }

  async refreshAccessToken(refreshToken: string) {
    const clientId = this.getOAuthClientId();
    const clientSecret = this.getOAuthClientSecret();
    const tokenUrl = this.getOAuthTokenUrl();

    if (!clientId || !clientSecret) {
      throw new HttpException(
        'Linear OAuth is not configured. Missing LINEAR_OAUTH_CLIENT_ID/LINEAR_OAUTH_CLIENT_SECRET',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!refreshToken?.trim()) {
      throw new HttpException('refreshToken is required', HttpStatus.BAD_REQUEST);
    }

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      throw new HttpException(
        String(payload.error_description || payload.error || 'Linear OAuth refresh failed'),
        HttpStatus.BAD_REQUEST,
      );
    }

    const accessToken = String(payload.access_token || '').trim();
    if (!accessToken) {
      throw new HttpException('Linear OAuth refresh is missing access_token', HttpStatus.BAD_GATEWAY);
    }

    return {
      provider: 'linear' as const,
      accessToken,
      refreshToken: String(payload.refresh_token || '').trim() || undefined,
      tokenType: String(payload.token_type || '').trim() || undefined,
      scope: String(payload.scope || '').trim() || undefined,
      expiresIn:
        typeof payload.expires_in === 'number'
          ? payload.expires_in
          : Number.parseInt(String(payload.expires_in || ''), 10) || undefined,
      raw: payload,
    };
  }

  async getViewer(tokenOverride?: string) {
    return this.rawQuery<{ viewer: unknown }>(
      `
      query Viewer {
        viewer {
          id
          name
          email
          displayName
          active
          admin
        }
      }
      `,
      undefined,
      tokenOverride,
    );
  }

  async listTeams(first = 50, tokenOverride?: string) {
    return this.rawQuery<{
      teams: {
        nodes: unknown[];
        pageInfo: { hasNextPage: boolean; endCursor?: string | null };
      };
    }>(
      `
      query Teams($first: Int!) {
        teams(first: $first) {
          nodes {
            id
            key
            name
            description
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
      `,
      { first },
      tokenOverride,
    );
  }

  async listUsers(first = 50, query?: string, tokenOverride?: string) {
    return this.rawQuery<{
      users: {
        nodes: unknown[];
        pageInfo: { hasNextPage: boolean; endCursor?: string | null };
      };
    }>(
      `
      query Users($first: Int!, $filter: UserFilter) {
        users(first: $first, filter: $filter) {
          nodes {
            id
            name
            email
            displayName
            active
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
      `,
      {
        first,
        filter: query
          ? {
              or: [
                { name: { containsIgnoreCase: query } },
                { email: { containsIgnoreCase: query } },
              ],
            }
          : undefined,
      },
      tokenOverride,
    );
  }

  async listProjects(params: {
    first?: number;
    after?: string;
    teamId?: string;
    query?: string;
  }, tokenOverride?: string) {
    const { first = 50, after, teamId, query } = params;

    const data = await this.rawQuery<{
      projects: {
        nodes: Array<{
          teams?: {
            nodes?: Array<{ id?: string }>;
          };
          [key: string]: unknown;
        }>;
        pageInfo: { hasNextPage: boolean; endCursor?: string | null };
      };
    }>(
      `
      query Projects($first: Int!, $after: String, $filter: ProjectFilter) {
        projects(first: $first, after: $after, filter: $filter) {
          nodes {
            id
            name
            slugId
            icon
            progress
            startDate
            targetDate
            state
            teams {
              nodes {
                id
                key
                name
              }
            }
            lead {
              id
              name
              email
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
      `,
      {
        first,
        after,
        filter: {
          // NOTE: ProjectFilter no longer supports "teams"; filter by team client-side below.
          ...(query ? { name: { containsIgnoreCase: query } } : {}),
        },
      },
      tokenOverride,
    );

    if (!teamId) {
      return data;
    }

    const filteredNodes = (data.projects.nodes || []).filter((project) =>
      (project.teams?.nodes || []).some((team) => team.id === teamId),
    );

    return {
      projects: {
        ...data.projects,
        nodes: filteredNodes,
      },
    };
  }

  async getProject(projectId: string, tokenOverride?: string) {
    return this.rawQuery<{ project: unknown }>(
      `
      query Project($id: String!) {
        project(id: $id) {
          id
          name
          slugId
          description
          state
          progress
          startDate
          targetDate
          lead {
            id
            name
            email
          }
          teams {
            nodes {
              id
              key
              name
            }
          }
        }
      }
      `,
      { id: projectId },
      tokenOverride,
    );
  }

  async createProject(input: Record<string, unknown>, tokenOverride?: string) {
    return this.rawQuery<{ projectCreate: { success: boolean; project: unknown } }>(
      `
      mutation CreateProject($input: ProjectCreateInput!) {
        projectCreate(input: $input) {
          success
          project {
            id
            name
            slugId
            state
            progress
            startDate
            targetDate
          }
        }
      }
      `,
      { input },
      tokenOverride,
    );
  }

  async updateProject(id: string, input: Record<string, unknown>, tokenOverride?: string) {
    return this.rawQuery<{ projectUpdate: { success: boolean; project: unknown } }>(
      `
      mutation UpdateProject($id: String!, $input: ProjectUpdateInput!) {
        projectUpdate(id: $id, input: $input) {
          success
          project {
            id
            name
            slugId
            state
            progress
            startDate
            targetDate
          }
        }
      }
      `,
      { id, input },
      tokenOverride,
    );
  }

  async listIssues(params: {
    first?: number;
    after?: string;
    teamId?: string;
    projectId?: string;
    stateName?: string;
    query?: string;
  }, tokenOverride?: string) {
    const { first = 50, after, teamId, projectId, stateName, query } = params;

    return this.rawQuery<{
      issues: {
        nodes: unknown[];
        pageInfo: { hasNextPage: boolean; endCursor?: string | null };
      };
    }>(
      `
      query Issues($first: Int!, $after: String, $filter: IssueFilter) {
        issues(first: $first, after: $after, filter: $filter) {
          nodes {
            id
            identifier
            title
            description
            priority
            estimate
            dueDate
            createdAt
            updatedAt
            url
            state {
              id
              name
              type
            }
            project {
              id
              name
            }
            team {
              id
              key
              name
            }
            assignee {
              id
              name
              email
            }
            labels {
              nodes {
                id
                name
                color
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
      `,
      {
        first,
        after,
        filter: {
          ...(teamId ? { team: { id: { eq: teamId } } } : {}),
          ...(projectId ? { project: { id: { eq: projectId } } } : {}),
          ...(stateName ? { state: { name: { eq: stateName } } } : {}),
          ...(query ? { title: { containsIgnoreCase: query } } : {}),
        },
      },
      tokenOverride,
    );
  }

  async getIssue(issueId: string, tokenOverride?: string) {
    return this.rawQuery<{ issue: unknown }>(
      `
      query Issue($id: String!) {
        issue(id: $id) {
          id
          identifier
          title
          description
          priority
          estimate
          dueDate
          createdAt
          updatedAt
          url
          state {
            id
            name
            type
          }
          project {
            id
            name
            slugId
          }
          team {
            id
            key
            name
          }
          assignee {
            id
            name
            email
          }
          creator {
            id
            name
            email
          }
          labels {
            nodes {
              id
              name
              color
            }
          }
        }
      }
      `,
      { id: issueId },
      tokenOverride,
    );
  }

  async createIssue(input: Record<string, unknown>, tokenOverride?: string) {
    return this.rawQuery<{ issueCreate: { success: boolean; issue: unknown } }>(
      `
      mutation CreateIssue($input: IssueCreateInput!) {
        issueCreate(input: $input) {
          success
          issue {
            id
            identifier
            title
            url
            state {
              id
              name
              type
            }
            project {
              id
              name
            }
            team {
              id
              key
              name
            }
          }
        }
      }
      `,
      { input },
      tokenOverride,
    );
  }

  async updateIssue(id: string, input: Record<string, unknown>, tokenOverride?: string) {
    return this.rawQuery<{ issueUpdate: { success: boolean; issue: unknown } }>(
      `
      mutation UpdateIssue($id: String!, $input: IssueUpdateInput!) {
        issueUpdate(id: $id, input: $input) {
          success
          issue {
            id
            identifier
            title
            url
            state {
              id
              name
              type
            }
            assignee {
              id
              name
              email
            }
          }
        }
      }
      `,
      { id, input },
      tokenOverride,
    );
  }

  async createComment(issueId: string, body: string, tokenOverride?: string) {
    return this.rawQuery<{ commentCreate: { success: boolean; comment: unknown } }>(
      `
      mutation CreateComment($input: CommentCreateInput!) {
        commentCreate(input: $input) {
          success
          comment {
            id
            body
            createdAt
            url
            user {
              id
              name
              email
            }
          }
        }
      }
      `,
      {
        input: {
          issueId,
          body,
        },
      },
      tokenOverride,
    );
  }

  async listCycles(teamId: string, first = 20, tokenOverride?: string) {
    return this.rawQuery<{
      team: {
        cycles: {
          nodes: unknown[];
          pageInfo: { hasNextPage: boolean; endCursor?: string | null };
        };
      };
    }>(
      `
      query TeamCycles($teamId: String!, $first: Int!) {
        team(id: $teamId) {
          id
          name
          cycles(first: $first) {
            nodes {
              id
              number
              name
              startsAt
              endsAt
              progress
              completedIssueCountHistory
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      }
      `,
      { teamId, first },
      tokenOverride,
    );
  }

  private getApiKey(tokenOverride?: string) {
    return (tokenOverride || this.configService.get('LINEAR_API_KEY') || '').trim();
  }

  private getOAuthClientId() {
    return (this.configService.get('LINEAR_OAUTH_CLIENT_ID') || '').trim();
  }

  private getOAuthClientSecret() {
    return (this.configService.get('LINEAR_OAUTH_CLIENT_SECRET') || '').trim();
  }

  private getOAuthAuthorizeUrl() {
    return (
      this.configService.get('LINEAR_OAUTH_AUTHORIZE_URL') ||
      'https://linear.app/oauth/authorize'
    ).trim();
  }

  private getOAuthTokenUrl() {
    return (
      this.configService.get('LINEAR_OAUTH_TOKEN_URL') ||
      'https://api.linear.app/oauth/token'
    ).trim();
  }

  private getOAuthScopes() {
    return (this.configService.get('LINEAR_OAUTH_SCOPES') || '').trim();
  }
}
