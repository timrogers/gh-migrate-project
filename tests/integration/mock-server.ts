/**
 * A lightweight mock HTTP server that mimics the GitHub API.
 * It handles REST and GraphQL requests, routing them to fixture responses
 * recorded from the real API.
 */

import * as http from 'http';
import {
  META_RESPONSE,
  META_HEADERS,
  RATE_LIMIT_RESPONSE,
  PROJECT_ID_RESPONSE,
  PROJECT_DETAIL_RESPONSE,
  PROJECT_ITEMS_RESPONSE,
  ORGANIZATION_ID_RESPONSE,
  CREATE_PROJECT_RESPONSE,
  REPOSITORY_ID_RESPONSE,
  LINK_REPOSITORY_RESPONSE,
  ISSUE_OR_PR_RESPONSE,
  ADD_ITEM_RESPONSE,
  CREATE_DRAFT_ISSUE_RESPONSE,
  UPDATE_FIELD_VALUE_RESPONSE,
  CREATE_FIELD_RESPONSE,
  PROJECT_STATUS_FIELD_RESPONSE,
  UPDATE_STATUS_FIELD_RESPONSE,
  ARCHIVE_ITEM_RESPONSE,
  USER_ID_RESPONSE,
  UPDATE_DRAFT_ISSUE_RESPONSE,
} from '../fixtures/graphql-responses.js';

export interface RequestLog {
  method: string;
  url: string;
  body?: Record<string, unknown>;
}

export class MockGitHubServer {
  private server: http.Server;
  private port = 0;
  private requestLog: RequestLog[] = [];
  private importItemCounter = 0;

  constructor() {
    this.server = http.createServer((req, res) => this.handleRequest(req, res));
  }

  async start(): Promise<number> {
    return new Promise((resolve) => {
      this.server.listen(0, '127.0.0.1', () => {
        const addr = this.server.address();
        if (addr && typeof addr !== 'string') {
          this.port = addr.port;
        }
        resolve(this.port);
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.close((err) => (err ? reject(err) : resolve()));
    });
  }

  getBaseUrl(): string {
    return `http://127.0.0.1:${this.port}`;
  }

  getRequestLog(): RequestLog[] {
    return [...this.requestLog];
  }

  getGraphqlQueries(): Array<{ query: string; variables: Record<string, unknown> }> {
    return this.requestLog
      .filter((r) => r.url === '/graphql' && r.body)
      .map(
        (r) => r.body as unknown as { query: string; variables: Record<string, unknown> },
      );
  }

  resetLog(): void {
    this.requestLog = [];
    this.importItemCounter = 0;
  }

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    let body = '';
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      const parsedBody = body ? JSON.parse(body) : undefined;
      this.requestLog.push({
        method: req.method || 'GET',
        url: req.url || '/',
        body: parsedBody,
      });

      // REST: /meta
      if (req.url === '/meta' || req.url === '/api/v3/meta') {
        // Include installed_version so the CLI treats this as a modern GHES instance
        // that supports automatic status field migration (>= 3.17.0)
        const metaWithVersion = { ...META_RESPONSE, installed_version: '3.17.0' };
        res.writeHead(200, { 'content-type': 'application/json', ...META_HEADERS });
        res.end(JSON.stringify(metaWithVersion));
        return;
      }

      // GraphQL
      if (req.url === '/graphql' || req.url === '/api/graphql') {
        this.handleGraphql(parsedBody, res);
        return;
      }

      // Fallback 404
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ message: 'Not Found' }));
    });
  }

  private handleGraphql(
    body: { query: string; variables?: Record<string, unknown> },
    res: http.ServerResponse,
  ): void {
    const query = body.query || '';
    const variables = body.variables || {};

    const response = this.routeGraphqlQuery(query, variables);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(response));
  }

  private routeGraphqlQuery(query: string, variables: Record<string, unknown>): unknown {
    // Rate limit
    if (query.includes('rateLimit')) {
      return RATE_LIMIT_RESPONSE;
    }

    // Get project ID for organization (export flow)
    if (
      query.includes('organization') &&
      query.includes('projectV2') &&
      query.includes('$number') &&
      !query.includes('mutation')
    ) {
      return PROJECT_ID_RESPONSE;
    }

    // Get project details (fields, views, repos)
    if (
      query.includes('node') &&
      query.includes('fields') &&
      query.includes('views') &&
      query.includes('repositories')
    ) {
      return PROJECT_DETAIL_RESPONSE;
    }

    // Get project items (paginated)
    if (query.includes('items') && query.includes('pageInfo')) {
      return PROJECT_ITEMS_RESPONSE;
    }

    // --- Import-related queries ---

    // Get organization global ID
    if (
      query.includes('organization') &&
      query.includes('id') &&
      !query.includes('projectV2')
    ) {
      return ORGANIZATION_ID_RESPONSE;
    }

    // Create project field (must be checked BEFORE createProjectV2 since the query contains that substring)
    if (query.includes('createProjectV2Field')) {
      const name = (variables.name as string) || 'Unknown';
      const dataType = variables.dataType as string;
      const fieldId = `PVTF_new_${name.toLowerCase().replace(/\s/g, '_')}`;
      const options =
        dataType === 'SINGLE_SELECT' && variables.singleSelectOptions
          ? (variables.singleSelectOptions as Array<{ name: string }>).map((opt, i) => ({
              id: `new_opt_${i}`,
              name: opt.name,
            }))
          : [];
      return CREATE_FIELD_RESPONSE(fieldId, name, options);
    }

    // Create project (createProjectV2 but NOT createProjectV2Field, not linkProjectV2, not addProjectV2, not updateProjectV2)
    if (query.includes('createProjectV2(') && query.includes('mutation')) {
      return CREATE_PROJECT_RESPONSE;
    }

    // Get project status field
    if (query.includes('field(name: "Status")')) {
      return PROJECT_STATUS_FIELD_RESPONSE;
    }

    // Update project field (status) - must be before general updateProjectV2ItemFieldValue
    if (query.includes('updateProjectV2Field') && !query.includes('ItemFieldValue')) {
      return UPDATE_STATUS_FIELD_RESPONSE;
    }

    // Get repository ID
    if (
      query.includes('repository') &&
      query.includes('id') &&
      !query.includes('issueOrPullRequest')
    ) {
      return REPOSITORY_ID_RESPONSE;
    }

    // Link repository to project
    if (query.includes('linkProjectV2ToRepository')) {
      return LINK_REPOSITORY_RESPONSE;
    }

    // Get issue or PR by number
    if (query.includes('issueOrPullRequest')) {
      const number = variables.number as number;
      return ISSUE_OR_PR_RESPONSE(`I_issue_${number}`, `Issue #${number}`);
    }

    // Add item to project
    if (query.includes('addProjectV2ItemById')) {
      this.importItemCounter++;
      return ADD_ITEM_RESPONSE(`PVTI_new_item_${this.importItemCounter}`);
    }

    // Create draft issue
    if (query.includes('addProjectV2DraftIssue')) {
      this.importItemCounter++;
      return CREATE_DRAFT_ISSUE_RESPONSE(`PVTI_new_draft_${this.importItemCounter}`);
    }

    // Update field value
    if (query.includes('updateProjectV2ItemFieldValue')) {
      return UPDATE_FIELD_VALUE_RESPONSE;
    }

    // Archive project item
    if (query.includes('archiveProjectV2Item')) {
      return ARCHIVE_ITEM_RESPONSE;
    }

    // Get user ID
    if (query.includes('user') && query.includes('id') && !query.includes('projectV2')) {
      const login = (variables.login as string) || 'unknown';
      return USER_ID_RESPONSE(login);
    }

    // Update draft issue (assignees)
    if (query.includes('updateProjectV2DraftIssue')) {
      return UPDATE_DRAFT_ISSUE_RESPONSE;
    }

    // GitHub product info (enterprise check)
    if (query.includes('enterprise')) {
      return { data: { enterprise: null } };
    }

    // Fallback
    return { data: {} };
  }
}
