/**
 * Fixtures for GraphQL API responses used by the mock server.
 * These represent the responses GitHub's API would return for each query the tool makes.
 */

export const META_RESPONSE = {
  verifiable_password_authentication: true,
};

export const META_HEADERS = {
  'x-oauth-scopes': 'repo, project',
};

export const RATE_LIMIT_RESPONSE = {
  data: {
    rateLimit: {
      limit: 5000,
      remaining: 4999,
      resetAt: '2099-01-01T00:00:00Z',
    },
  },
};

export const ORGANIZATION_PROJECT_ID_RESPONSE = {
  data: {
    organization: {
      projectV2: {
        id: 'PVT_kwHOTestOrg123',
        url: 'https://github.com/orgs/gh-migrate-project-sandbox/projects/1026',
      },
    },
  },
};

export const USER_PROJECT_ID_RESPONSE = {
  data: {
    user: {
      projectV2: {
        id: 'PVT_kwHOTestUser123',
        url: 'https://github.com/users/test-user/projects/1',
      },
    },
  },
};

export const PROJECT_RESPONSE = {
  data: {
    node: {
      closed: false,
      public: true,
      shortDescription: 'A test project for integration testing',
      title: 'Integration Test Project',
      fields: {
        nodes: [
          {
            id: 'PVTF_field_title_001',
            name: 'Title',
            dataType: 'TITLE',
          },
          {
            id: 'PVTF_field_status_001',
            name: 'Status',
            dataType: 'SINGLE_SELECT',
            __typename: 'ProjectV2SingleSelectField',
            options: [
              { id: 'opt_todo', name: 'Todo', description: 'Items to do', color: 'GREEN' },
              {
                id: 'opt_in_progress',
                name: 'In Progress',
                description: 'Items in progress',
                color: 'YELLOW',
              },
              {
                id: 'opt_done',
                name: 'Done',
                description: 'Completed items',
                color: 'PURPLE',
              },
            ],
          },
          {
            id: 'PVTF_field_priority_001',
            name: 'Priority',
            dataType: 'SINGLE_SELECT',
            __typename: 'ProjectV2SingleSelectField',
            options: [
              { id: 'opt_high', name: 'High', color: 'RED' },
              { id: 'opt_medium', name: 'Medium', color: 'ORANGE' },
              { id: 'opt_low', name: 'Low', color: 'BLUE' },
            ],
          },
          {
            id: 'PVTF_field_estimate_001',
            name: 'Estimate',
            dataType: 'NUMBER',
            __typename: 'ProjectV2Field',
          },
          {
            id: 'PVTF_field_due_date_001',
            name: 'Due Date',
            dataType: 'DATE',
            __typename: 'ProjectV2Field',
          },
          {
            id: 'PVTF_field_notes_001',
            name: 'Notes',
            dataType: 'TEXT',
            __typename: 'ProjectV2Field',
          },
          {
            id: 'PVTF_field_iteration_001',
            name: 'Sprint',
            dataType: 'ITERATION',
            __typename: 'ProjectV2IterationField',
            configuration: {
              iterations: [
                { startDate: '2024-01-01', id: 'iter_1' },
                { startDate: '2024-01-15', id: 'iter_2' },
              ],
            },
          },
        ],
        totalCount: 7,
      },
      repositories: {
        nodes: [{ nameWithOwner: 'gh-migrate-project-sandbox/initial-repository' }],
        totalCount: 1,
      },
      views: {
        nodes: [
          {
            filter: null,
            layout: 'TABLE_LAYOUT',
            name: 'All Items',
            number: 1,
            fields: {
              nodes: [{ id: 'PVTF_field_title_001' }, { id: 'PVTF_field_status_001' }],
              totalCount: 2,
            },
            groupByFields: { nodes: [], totalCount: 0 },
            sortByFields: {
              nodes: [{ direction: 'ASC', field: { id: 'PVTF_field_priority_001' } }],
              totalCount: 1,
            },
            verticalGroupByFields: { nodes: [], totalCount: 0 },
            visibleFields: {
              nodes: [
                { id: 'PVTF_field_title_001' },
                { id: 'PVTF_field_status_001' },
                { id: 'PVTF_field_priority_001' },
              ],
              totalCount: 3,
            },
          },
          {
            filter: 'status:"In Progress"',
            layout: 'BOARD_LAYOUT',
            name: 'Board View',
            number: 2,
            fields: {
              nodes: [{ id: 'PVTF_field_title_001' }, { id: 'PVTF_field_status_001' }],
              totalCount: 2,
            },
            groupByFields: { nodes: [{ id: 'PVTF_field_status_001' }], totalCount: 1 },
            sortByFields: { nodes: [], totalCount: 0 },
            verticalGroupByFields: { nodes: [], totalCount: 0 },
            visibleFields: {
              nodes: [{ id: 'PVTF_field_title_001' }, { id: 'PVTF_field_status_001' }],
              totalCount: 2,
            },
          },
        ],
        totalCount: 2,
      },
    },
  },
};

export const PROJECT_ITEMS_RESPONSE = {
  data: {
    node: {
      items: {
        nodes: [
          {
            content: {
              __typename: 'Issue',
              title: 'First issue for testing',
              number: 1,
              repository: { nameWithOwner: 'gh-migrate-project-sandbox/initial-repository' },
            },
            fieldValues: {
              nodes: [
                {
                  __typename: 'ProjectV2ItemFieldSingleSelectValue',
                  field: { id: 'PVTF_field_status_001', name: 'Status' },
                  optionId: 'opt_in_progress',
                },
                {
                  __typename: 'ProjectV2ItemFieldSingleSelectValue',
                  field: { id: 'PVTF_field_priority_001', name: 'Priority' },
                  optionId: 'opt_high',
                },
                {
                  __typename: 'ProjectV2ItemFieldNumberValue',
                  field: { id: 'PVTF_field_estimate_001', name: 'Estimate' },
                  number: 5,
                },
                {
                  __typename: 'ProjectV2ItemFieldDateValue',
                  field: { id: 'PVTF_field_due_date_001', name: 'Due Date' },
                  date: '2024-03-01',
                },
              ],
              totalCount: 4,
            },
            isArchived: false,
            type: 'ISSUE',
            id: 'PVTI_item_001',
          },
          {
            content: {
              __typename: 'Issue',
              title: 'Second issue with notes',
              number: 2,
              repository: { nameWithOwner: 'gh-migrate-project-sandbox/initial-repository' },
            },
            fieldValues: {
              nodes: [
                {
                  __typename: 'ProjectV2ItemFieldSingleSelectValue',
                  field: { id: 'PVTF_field_status_001', name: 'Status' },
                  optionId: 'opt_todo',
                },
                {
                  __typename: 'ProjectV2ItemFieldTextValue',
                  field: { id: 'PVTF_field_notes_001', name: 'Notes' },
                  text: 'Some important notes',
                },
              ],
              totalCount: 2,
            },
            isArchived: false,
            type: 'ISSUE',
            id: 'PVTI_item_002',
          },
          {
            content: {
              __typename: 'PullRequest',
              title: 'Fix the bug',
              number: 3,
              repository: { nameWithOwner: 'gh-migrate-project-sandbox/initial-repository' },
            },
            fieldValues: {
              nodes: [
                {
                  __typename: 'ProjectV2ItemFieldSingleSelectValue',
                  field: { id: 'PVTF_field_status_001', name: 'Status' },
                  optionId: 'opt_done',
                },
              ],
              totalCount: 1,
            },
            isArchived: false,
            type: 'PULL_REQUEST',
            id: 'PVTI_item_003',
          },
          {
            content: {
              __typename: 'DraftIssue',
              title: 'Draft: Plan the migration',
              body: 'We need to plan the migration carefully.',
              createdAt: '2024-01-15T10:00:00Z',
              creator: { login: 'timrogers' },
              assignees: { nodes: [{ login: 'timrogers' }], totalCount: 1 },
            },
            fieldValues: {
              nodes: [
                {
                  __typename: 'ProjectV2ItemFieldSingleSelectValue',
                  field: { id: 'PVTF_field_status_001', name: 'Status' },
                  optionId: 'opt_todo',
                },
                {
                  __typename: 'ProjectV2ItemFieldIterationValue',
                  field: { id: 'PVTF_field_iteration_001', name: 'Sprint' },
                  duration: 14,
                  iterationId: 'iter_1',
                  startDate: '2024-01-01',
                  title: 'Sprint 1',
                  titleHTML: 'Sprint 1',
                },
              ],
              totalCount: 2,
            },
            isArchived: false,
            type: 'DRAFT_ISSUE',
            id: 'PVTI_item_004',
          },
          {
            content: {
              __typename: 'Issue',
              title: 'Archived issue',
              number: 5,
              repository: { nameWithOwner: 'gh-migrate-project-sandbox/initial-repository' },
            },
            fieldValues: {
              nodes: [
                {
                  __typename: 'ProjectV2ItemFieldSingleSelectValue',
                  field: { id: 'PVTF_field_status_001', name: 'Status' },
                  optionId: 'opt_done',
                },
              ],
              totalCount: 1,
            },
            isArchived: true,
            type: 'ISSUE',
            id: 'PVTI_item_005',
          },
        ],
        pageInfo: {
          hasNextPage: false,
          endCursor: 'cursor_end',
        },
      },
    },
  },
};

// Import-related responses
export const ORGANIZATION_ID_RESPONSE = {
  data: {
    organization: {
      id: 'O_kwHOTestOrg',
    },
  },
};

export const CREATE_PROJECT_RESPONSE = {
  data: {
    createProjectV2: {
      projectV2: {
        id: 'PVT_kwHONewProject',
        url: 'https://github.com/orgs/gh-migrate-project-sandbox/projects/9999',
      },
    },
  },
};

export const GITHUB_PRODUCT_RESPONSE = {
  data: {
    enterprise: null,
  },
};

export const REPOSITORY_ID_RESPONSE = {
  data: {
    repository: {
      id: 'R_kgRepo001',
    },
  },
};

export const LINK_REPOSITORY_RESPONSE = {
  data: {
    linkProjectV2ToRepository: {
      repository: { id: 'R_kgRepo001' },
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
        id: 'PVTF_new_status_001',
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
        id: 'PVTF_new_status_001',
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
