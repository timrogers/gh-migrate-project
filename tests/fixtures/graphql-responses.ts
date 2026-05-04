/**
 * Fixture data recorded from real GitHub API responses.
 * Source: gh-migrate-project-sandbox, project #1026
 * Recorded: 2026-05-04
 *
 * These fixtures are used by the mock server to replay realistic API responses
 * without needing network access or a token.
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const rawFixtures = JSON.parse(
  readFileSync(join(__dirname, 'recorded-api-responses.json'), 'utf-8'),
);

// The OAuth scopes header returned by the /meta endpoint
export const META_HEADERS: Record<string, string> = {
  'x-oauth-scopes': 'repo, project, write:org',
};

// The /meta endpoint response body
export const META_RESPONSE = rawFixtures.meta.body;

// GraphQL: rate limit query
export const RATE_LIMIT_RESPONSE = rawFixtures.rateLimit;

// GraphQL: get project ID by org and number
export const PROJECT_ID_RESPONSE = rawFixtures.projectId;

// GraphQL: get project details (fields, views, repos)
export const PROJECT_DETAIL_RESPONSE = rawFixtures.project;

// GraphQL: get project items (content, field values)
export const PROJECT_ITEMS_RESPONSE = rawFixtures.items;

// The actual project global ID from fixtures
export const RECORDED_PROJECT_ID: string =
  rawFixtures.projectId.data.organization.projectV2.id;

// --- Import-related mock responses ---

export const ORGANIZATION_ID_RESPONSE = {
  data: {
    organization: {
      id: 'O_kwDOCQuCac',
    },
  },
};

export const CREATE_PROJECT_RESPONSE = {
  data: {
    createProjectV2: {
      projectV2: {
        id: 'PVT_kwDONewProject',
        url: 'https://github.com/orgs/gh-migrate-project-sandbox/projects/9999',
      },
    },
  },
};

export const REPOSITORY_ID_RESPONSE = {
  data: {
    repository: {
      id: 'R_kgDORepo001',
    },
  },
};

export const LINK_REPOSITORY_RESPONSE = {
  data: {
    linkProjectV2ToRepository: {
      repository: { id: 'R_kgDORepo001' },
    },
  },
};

export const ISSUE_OR_PR_RESPONSE = (id: string, title: string) => ({
  data: {
    repository: {
      issueOrPullRequest: { id, title },
    },
  },
});

export const ADD_ITEM_RESPONSE = (itemId: string) => ({
  data: {
    addProjectV2ItemById: {
      item: { id: itemId },
    },
  },
});

export const CREATE_DRAFT_ISSUE_RESPONSE = (itemId: string) => ({
  data: {
    addProjectV2DraftIssue: {
      projectItem: { id: itemId },
    },
  },
});

export const UPDATE_FIELD_VALUE_RESPONSE = {
  data: {
    updateProjectV2ItemFieldValue: {
      projectV2Item: { id: 'PVTI_item_updated' },
    },
  },
};

export const CREATE_FIELD_RESPONSE = (
  id: string,
  name: string,
  options: Array<{ id: string; name: string }> = [],
) => ({
  data: {
    createProjectV2Field: {
      projectV2Field: { id, name, options },
    },
  },
});

export const PROJECT_STATUS_FIELD_RESPONSE = {
  data: {
    node: {
      field: {
        id: 'PVTSSF_new_status',
        options: [
          { id: 'new_opt_todo', name: 'Todo' },
          { id: 'new_opt_in_progress', name: 'In Progress' },
          { id: 'new_opt_done', name: 'Done' },
        ],
      },
    },
  },
};

export const UPDATE_STATUS_FIELD_RESPONSE = {
  data: {
    updateProjectV2Field: {
      projectV2Field: {
        id: 'PVTSSF_new_status',
        name: 'Status',
        options: [
          { id: 'new_opt_todo', name: 'Todo' },
          { id: 'new_opt_in_progress', name: 'In Progress' },
          { id: 'new_opt_done', name: 'Done' },
        ],
      },
    },
  },
};

export const ARCHIVE_ITEM_RESPONSE = {
  data: {
    archiveProjectV2Item: {
      item: { id: 'PVTI_item_archived' },
    },
  },
};

export const USER_ID_RESPONSE = (login: string) => ({
  data: {
    user: {
      id: `U_kg${login}`,
    },
  },
});

export const UPDATE_DRAFT_ISSUE_RESPONSE = {
  data: {
    updateProjectV2DraftIssue: {
      draftIssue: { id: 'DI_updated' },
    },
  },
};
