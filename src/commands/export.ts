import * as commander from 'commander';
import { existsSync, writeFileSync } from 'fs';
import { type Octokit } from 'octokit';

import { actionRunner, logRateLimitInformation } from '../utils.js';
import VERSION from '../version.js';
import { createLogger } from '../logger.js';
import { createOctokit } from '../octokit.js';
import { type Project, type ProjectItem } from '../graphql-types.js';
import { getReferencedRepositories } from '../project-items.js';

const command = new commander.Command();
const { Option } = commander;

enum ProjectOwnerType {
  Organization = 'organization',
  User = 'user',
}

interface Arguments {
  accessToken?: string;
  baseUrl: string;
  projectOutputPath: string;
  repositoryMappingsOutputPath: string;
  projectOwner: string;
  projectOwnerType: ProjectOwnerType;
  projectNumber: number;
}

const getGlobalIdForProject = async ({
  owner,
  ownerType,
  number,
  octokit,
}: {
  owner: string;
  ownerType: ProjectOwnerType;
  number: number;
  octokit: Octokit;
}): Promise<string> => {
  switch (ownerType) {
    case ProjectOwnerType.Organization:
      return await getGlobalIdForOrganizationOwnedProject({
        organization: owner,
        number,
        octokit,
      });
    case ProjectOwnerType.User:
      return await getGlobalIdForUserOwnedProject({
        user: owner,
        number,
        octokit,
      });
  }
};

const getGlobalIdForOrganizationOwnedProject = async ({
  organization,
  number,
  octokit,
}: {
  organization: string;
  number: number;
  octokit: Octokit;
}): Promise<string> => {
  const response = (await octokit.graphql(
    `query getProjectGlobalId($organization: String!, $number: Int!) {
      organization(login: $organization) {
        projectV2(number: $number) {
          id
        }
      }
    }`,
    {
      organization,
      number,
    },
  )) as { organization: { projectV2: { id: string } } };

  return response.organization.projectV2.id;
};

const getGlobalIdForUserOwnedProject = async ({
  user,
  number,
  octokit,
}: {
  user: string;
  number: number;
  octokit: Octokit;
}): Promise<string> => {
  const response = (await octokit.graphql(
    `query getProjectGlobalId($user: String!, $number: Int!) {
      user(login: $user) {
        projectV2(number: $number) {
          id
        }
      }
    }`,
    {
      user,
      number,
    },
  )) as { user: { projectV2: { id: string } } };

  return response.user.projectV2.id;
};

const getProjectItems = async ({
  id,
  octokit,
}: {
  id: string;
  octokit: Octokit;
}): Promise<ProjectItem[]> => {
  const response = await octokit.graphql.paginate(
    `query getProjectItems($id: ID!, $cursor: String) {
      node(id: $id) {
        ... on ProjectV2 {
          items(first: 100, after: $cursor) {
            nodes {
              content {
                __typename
                ... on Issue {
                  title
                  number
                  repository {
                    nameWithOwner
                  }
                }
                ... on PullRequest {
                  title
                  number
                  repository {
                    nameWithOwner
                  }
                }
                ... on DraftIssue {
                  title
                  body
                  createdAt
                  creator {
                    login
                  }
                }
              }
              fieldValues(first: 100) {
                nodes {
                  __typename
                  ... on ProjectV2ItemFieldDateValue {
                    date
                    field {
                      ... on ProjectV2FieldCommon {
                        id
                        name
                      }
                    }
                  }
                  ... on ProjectV2ItemFieldIterationValue {
                    duration
                    iterationId
                    startDate
                    title
                    titleHTML
                    field {
                      ... on ProjectV2FieldCommon {
                        id
                        name
                      }
                    }
                  } 
                  ... on ProjectV2ItemFieldNumberValue {
                    number
                    field {
                      ... on ProjectV2FieldCommon {
                        id
                        name
                      }
                    }
                  }
                  ... on ProjectV2ItemFieldSingleSelectValue {
                    field {
                      ... on ProjectV2FieldCommon {
                        id
                        name
                      }
                    }
                    optionId
                  }
                  ... on ProjectV2ItemFieldTextValue {
                    text
                    field {
                      ... on ProjectV2FieldCommon {
                        id
                        name
                      }
                    }
                  }
                }
                totalCount
              }
              isArchived
              type
              id
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      }
    }`,
    {
      id,
    },
  );

  return response.node.items.nodes;
};

const getProject = async ({
  id,
  octokit,
}: {
  id: string;
  octokit: Octokit;
}): Promise<Project> => {
  const response = (await octokit.graphql(
    `query getProject($id: ID!) {
      node(id: $id) {
        ... on ProjectV2 {
          closed
          public
          shortDescription
          title
          fields(first: 100) {
            nodes {
              ... on ProjectV2Field {
                id
                name
                dataType
              }
              ... on ProjectV2IterationField {
                id
                name
                dataType
                configuration {
                  iterations {
                    startDate
                    id
                  }
                }
              }
              ... on ProjectV2SingleSelectField {
                id
                name
                dataType
                options {
                  id
                  name
                  description
                  color
                }
              }
            }
            totalCount
          }
          repositories(first: 100) {
            nodes {
              nameWithOwner
            }
            totalCount
          }
          workflows(first: 100) {
            nodes {
              enabled
              name
              number
            }
            totalCount
          }
          views(first: 100) {
            nodes {
              filter
              layout
              name
              number
              fields(first: 100) {
                nodes {
                  ... on ProjectV2FieldCommon {
                    id
                  }
                }
                totalCount
              }
              groupByFields(first: 100) {
                nodes {
                  ... on ProjectV2FieldCommon {
                    id
                  }
                }
                totalCount
              }
              sortByFields(first: 100) {
                nodes {
                  direction
                  field {
                    ... on ProjectV2FieldCommon {
                      id
                    }
                  }
                }
                totalCount
              }
              verticalGroupByFields(first: 100) {
                nodes {
                  ... on ProjectV2FieldCommon {
                    id
                  }
                }
                totalCount
              }
              visibleFields(first: 100) {
                nodes {
                  ... on ProjectV2FieldCommon {
                    id
                  }
                }
                totalCount
              }
            }
            totalCount
          } 
        } 
      }
    }`,
    {
      id,
    },
  )) as { node: Project };

  return response.node;
};

command
  .name('export')
  .version(VERSION)
  .description('Export a GitHub project')
  .option(
    '--access-token <access_token>',
    'The access token used to interact with the GitHub API. This can also be set using the GITHUB_TOKEN environment variable.',
    process.env.GITHUB_TOKEN,
  )
  .option(
    '--base-url <base_url>',
    'The base URL for the GitHub API. You only need to set this if you are migrating from a GitHub product other than GitHub.com',
    'https://api.github.com',
  )
  .option(
    '--project-output-path <project_output_path>',
    'The path to write the exported data to',
    'project.json',
  )
  .option(
    '--repository-mappings-output-path <repository_mappings_output_path>',
    'The path to write the repositories template to',
    'repository-mappings.csv',
  )
  .requiredOption(
    '--project-owner <project_owner>',
    'The organization or user who owns the project to export',
  )
  .addOption(
    new Option(
      '--project-owner-type <project_owner_type>',
      'The type of the owner of the project',
    )
      .choices(['organization', 'user'])
      .default(ProjectOwnerType.Organization),
  )
  .requiredOption(
    '--project-number <project_number>',
    'The number of the project to export',
    (value) => parseInt(value),
  )
  .action(
    actionRunner(async (opts: Arguments) => {
      const {
        accessToken,
        baseUrl,
        projectOutputPath,
        repositoryMappingsOutputPath,
        projectOwner,
        projectOwnerType,
        projectNumber,
      } = opts;

      if (!accessToken) {
        throw new Error(
          'You must specify a GitHub access token using the --access-token argument or GITHUB_TOKEN environment variable.',
        );
      }

      if (existsSync(projectOutputPath)) {
        throw new Error(
          `The project output path, \`${projectOutputPath}\` already exists. Please delete the existing file or specify a different path using the --project-output-path argument.`,
        );
      }

      if (existsSync(repositoryMappingsOutputPath)) {
        throw new Error(
          `The repositories mappings output path, \`${repositoryMappingsOutputPath}\` already exists. Please delete the existing file or specify a different path using the --repository-mappings-output-path argument.`,
        );
      }

      const logger = createLogger(true);
      const octokit = createOctokit(accessToken, baseUrl);

      void logRateLimitInformation(logger, octokit);
      setInterval(() => {
        void logRateLimitInformation(logger, octokit);
      }, 30_000);

      logger.info(
        `Looking up ID for project ${projectNumber} owned by ${projectOwnerType} ${projectOwner}...`,
      );
      const projectId = await getGlobalIdForProject({
        owner: projectOwner,
        ownerType: projectOwnerType,
        number: projectNumber,
        octokit,
      });
      logger.info(
        `Successfully looked up ID for project ${projectNumber} owned by ${projectOwnerType} ${projectOwner}: ${projectId}`,
      );

      logger.info(`Fetching project by GraphQL ID ${projectId}...`);
      const project = await getProject({ id: projectId, octokit });
      logger.info(`Successfully fetched project "${project.title}"`);

      logger.info(`Fetching project items...`);
      const projectItems = await getProjectItems({ id: projectId, octokit });
      logger.info(`Successfully fetched ${projectItems.length} project item(s)`);

      logger.info(`Writing project data to ${projectOutputPath}...`);
      writeFileSync(
        projectOutputPath,
        JSON.stringify({ project, projectItems }, null, 2),
      );
      logger.info(`Successfully wrote project data to ${projectOutputPath}`);

      const referencedRepositories = getReferencedRepositories(projectItems);
      const repositoriesTemplateCsvOutput =
        'source_repository,target_repository\n' +
        Array.from(referencedRepositories)
          .map((nwo) => `${nwo},`)
          .join('\n');

      logger.info(
        `Writing repositories mappings CSV to ${repositoryMappingsOutputPath}...`,
      );
      writeFileSync(repositoryMappingsOutputPath, repositoriesTemplateCsvOutput);
      logger.info(
        `Successfully wrote repositories mappings CSV to ${repositoryMappingsOutputPath}`,
      );
      process.exit(0);
    }),
  );

export default command;
