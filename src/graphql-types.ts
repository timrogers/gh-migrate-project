export enum ProjectFieldType {
  Iteration = 'ProjectV2IterationField',
  SingleSelect = 'ProjectV2SingleSelectField',
  Generic = 'ProjectV2Field',
}

export enum ProjectSortByFieldDirection {
  Ascending = 'ASC',
  Descending = 'DESC',
}

export enum ProjectFieldLayout {
  TABLE = 'TABLE_LAYOUT',
  BOARD = 'BOARD_LAYOUT',
}

export enum ProjectItemType {
  Issue = 'ISSUE',
  DraftIssue = 'DRAFT_ISSUE',
  PullRequest = 'PULL_REQUEST',
  Redacted = 'REDACTED',
}

export enum ProjectItemFieldValueType {
  Iteration = 'ProjectV2ItemFieldIterationValue',
  SingleSelect = 'ProjectV2ItemFieldSingleSelectValue',
  Date = 'ProjectV2ItemFieldDateValue',
  Label = 'ProjectV2ItemFieldLabelValue',
  Milestone = 'ProjectV2ItemFieldMilestoneValue',
  Number = 'ProjectV2ItemFieldNumberValue',
  PullRequest = 'ProjectV2ItemFieldPullRequestValue',
  Repository = 'ProjectV2ItemFieldRepositoryValue',
  Reviewer = 'ProjectV2ItemFieldReviewerValue',
  Text = 'ProjectV2ItemFieldTextValue',
  User = 'ProjectV2ItemFieldUserValue',
}

export enum ProjectSingleSelectFieldOptionColor {
  BLUE,
  GRAY,
  GREEN,
  ORANGE,
  PINK,
  PURPLE,
  RED,
  YELLOW,
}

export interface Project {
  closed: boolean;
  public: boolean;
  shortDescription: string | null;
  title: string;
  fields: {
    nodes: Array<{
      id: string;
      name: string;
      dataType: string;
      __typename: ProjectFieldType;
      options?: Array<{
        id: string;
        name: string;
        description: string;
        color: ProjectSingleSelectFieldOptionColor;
      }>;
    }>;
    totalCount: number;
  };
  repositories: {
    nodes: Array<{
      nameWithOwner: string;
    }>;
    totalCount: number;
  };
  workflows: {
    nodes: {
      enabled: boolean;
      name: string;
      number: number;
    };
    totalCount: number;
  };
  views: {
    nodes: Array<{
      filter: string;
      layout: ProjectFieldLayout;
      name: string;
      number: number;
      fields: {
        nodes: Array<{
          id: string;
        }>;
        totalCount: number;
      };
      groupByFields: {
        nodes: Array<{
          id: string;
        }>;
        totalCount: number;
      };
      sortByFields: {
        nodes: Array<{
          direction: ProjectSortByFieldDirection;
          field: {
            id: string;
          };
        }>;
        totalCount: number;
      };
      verticalGroupByFields: {
        nodes: Array<{
          id: string;
        }>;
        totalCount: number;
      };
      visibleFields: {
        nodes: Array<{
          id: string;
        }>;
        totalCount: number;
      };
    }>;
  };
}

export interface ProjectItem {
  content: {
    __typename: string;
    title: string;
    number: number;
    repository: {
      nameWithOwner: string;
    };
    body?: string;
    createdAt?: string;
    creator?: {
      login: string;
    };
  };
  fieldValues: {
    nodes: Array<{
      __typename: ProjectItemFieldValueType;
      field: {
        id: string;
        name: string;
      };
      // Fields from ProjectV2ItemFieldDateValue
      date?: string;
      // Fields from ProjectV2ItemFieldIterationValue
      duration?: number;
      iterationId?: string;
      startDate?: string;
      title?: string;
      titleHTML?: string;
      // Fields from ProjectV2ItemFieldNumberValue
      number?: number;
      // Fields from ProjectV2ItemFieldSingleSelectValue
      optionId?: string;
      // Fields from ProjectV2ItemFieldTextValue
      text?: string;
    }>;
    totalCount: number;
  };
  isArchived: boolean;
  type: ProjectItemType;
  id: string;
}
