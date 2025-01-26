import * as commander from 'npm:commander';
import { existsSync, writeFileSync } from 'node:fs';
import crypto from 'node:crypto';
import { type Octokit } from 'npm:octokit';
import { format, lessOrEqual, SemVer } from 'jsr:@std/semver';
import { PostHog } from 'npm:posthog-node';

import {
  actionRunner,
  checkForUpdates,
  logRateLimitInformation,
  normalizeBaseUrl,
  validateTokenOAuthScopes,
} from '../utils.ts';
import VERSION from '../version.ts';
import { createLogger, Logger } from '../logger.ts';
import { createOctokit } from '../octokit.ts';
import { type Project, type ProjectItem } from '../graphql-types.ts';
import { getReferencedRepositories } from '../project-items.ts';
import {
  GitHubProduct,
  MINIMUM_SUPPORTED_GITHUB_ENTERPRISE_SERVER_VERSION_FOR_EXPORTS,
  getGitHubProductInformation,
} from '../github-products.ts';
import { POSTHOG_API_KEY, POSTHOG_HOST } from '../posthog.ts';

const command = new commander.Command();
const { Option } = commander;

enum ProjectOwnerType {
  Organization = 'organization',
  User = 'user',
}

interface Arguments {
  accessToken?: string;
  baseUrl: string;
  disableTelemetry: boolean;
  projectOutputPath: string;
  repositoryMappingsOutputPath: string;
  projectOwner: string;
  projectOwnerType: ProjectOwnerType;
  projectNumber: number;
  proxyUrl: string | undefined;
  skipCertificateVerification: boolean;
  skipUpdateCheck: boolean;
  verbose: boolean;
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
  logger,
}: {
  id: string;
  octokit: Octokit;
  logger: Logger;
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

  const allProjectItems = response.node.items.nodes as ProjectItem[];

  const validProjectItems = allProjectItems.filter((projectItem) => {
    if (!projectItem.content) {
      logger.warn(
        `Skipping project item ${projectItem.id} because its linked issue or pull request could not be retrieved - your access token may lack the required permissions, or you may not have access to the issue or pull request.`,
      );
      logger.debug('Skipped project item:', projectItem);

      return false;
    }

    return true;
  });

  return validProjectItems;
};

const getProject = async ({
  id,
  octokit,
  gitHubEnterpriseServerVersion,
}: {
  id: string;
  octokit: Octokit;
  gitHubEnterpriseServerVersion: SemVer | undefined;
}): Promise<Project> => {
  // At the time of writing, these fields are only present on GitHub.com
  const shouldGetFieldDescriptionAndColor =
    typeof gitHubEnterpriseServerVersion === 'undefined';

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
                  ${shouldGetFieldDescriptionAndColor ? 'description' : ''}
                  ${shouldGetFieldDescriptionAndColor ? 'color' : ''}
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
  .version(format(VERSION))
  .description('Export a GitHub project')
  .option(
    '--access-token <access_token>',
    'The access token used to interact with the GitHub API. This can also be set using the EXPORT_GITHUB_TOKEN environment variable.',
  )
  .option(
    '--base-url <base_url>',
    'The base URL for the GitHub API if you are exporting from a source other than GitHub.com. For GitHub Enterprise Server, this will be something like `https://github.acme.inc/api/v3`. For GitHub Enterprise Cloud with data residency, this will be `https://api.acme.ghe.com`, replacing `acme` with your own tenant.',
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
  .option(
    '--proxy-url <proxy_url>',
    'The URL of an HTTP(S) proxy to use for requests to the GitHub API (e.g. `http://localhost:3128`). This can also be set using the EXPORT_PROXY_URL environment variable.',
    process.env.EXPORT_PROXY_URL,
  )
  .option('--verbose', 'Emit detailed, verbose logs', false)
  .option(
    '--disable-telemetry',
    'Disable anonymous telemetry that gives the maintainers of this tool basic information about real-world usage. For more detailed information about the built-in telemetry, see the readme at https://github.com/timrogers/gh-migrate-project.',
    false,
  )
  .option('--skip-update-check', 'Skip automatic check for updates to this tool', false)
  .option(
    '--skip-certificate-verification',
    'Skip verification of SSL certificates when connecting to GitHub. You may need to use this option if connecting to a GitHub Enterprise Server instance with a self-signed certificate, or if you have configured a proxy.',
    false,
  )
  .action(
    actionRunner(async (opts: Arguments) => {
      const {
        accessToken: accessTokenFromArguments,
        baseUrl: baseUrlFromArguments,
        disableTelemetry,
        projectNumber,
        projectOutputPath,
        projectOwner,
        projectOwnerType,
        proxyUrl,
        repositoryMappingsOutputPath,
        skipCertificateVerification,
        skipUpdateCheck,
        verbose,
      } = opts;

      const logger = createLogger(verbose);

      if (skipCertificateVerification) process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

      if (proxyUrl && process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0') {
        logger.warn(
          'You have specified a proxy URL, but have not disabled certificate verification. This is likely to cause SSL connection errors. If you encounter SSL errors, make sure you are on a trusted network, and then try again with the --skip-certificate-verification flag.',
        );
      }

      if (!skipUpdateCheck) checkForUpdates(proxyUrl, logger);

      const posthog = new PostHog(POSTHOG_API_KEY, {
        disabled: disableTelemetry,
        host: POSTHOG_HOST,
      });

      const accessToken = accessTokenFromArguments || process.env.EXPORT_GITHUB_TOKEN;

      if (!accessToken) {
        throw new Error(
          'You must specify a GitHub access token using the --access-token argument or EXPORT_GITHUB_TOKEN environment variable.',
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

      const baseUrl = normalizeBaseUrl(baseUrlFromArguments, logger);

      const octokit = createOctokit(accessToken, baseUrl, proxyUrl, logger);

      const shouldCheckRateLimitAgain = await logRateLimitInformation(logger, octokit);

      if (shouldCheckRateLimitAgain) {
        setInterval(() => {
          void logRateLimitInformation(logger, octokit);
        }, 30_000);
      }

      const { githubProduct, gitHubEnterpriseServerVersion } =
        await getGitHubProductInformation(octokit);

      if (githubProduct === GitHubProduct.GHES) {
        if (
          lessOrEqual(
            gitHubEnterpriseServerVersion,
            MINIMUM_SUPPORTED_GITHUB_ENTERPRISE_SERVER_VERSION_FOR_EXPORTS,
          )
        ) {
          throw new Error(
            `You are trying to export from GitHub Enterprise Server ${gitHubEnterpriseServerVersion}, but only ${MINIMUM_SUPPORTED_GITHUB_ENTERPRISE_SERVER_VERSION_FOR_EXPORTS} onwards is supported.`,
          );
        }

        logger.info(
          `Running export in GitHub Enterprse Server ${gitHubEnterpriseServerVersion} mode`,
        );
      } else {
        logger.info(`Running export in ${githubProduct} mode`);
      }

      if (!disableTelemetry) {
        posthog.capture({
          distinctId: crypto.randomUUID(),
          event: 'export_start',
          properties: {
            github_enterprise_server_version: gitHubEnterpriseServerVersion,
            githubProduct: githubProduct,
            version: VERSION,
          },
        });
      }

      await validateTokenOAuthScopes({
        octokit,
        logger,
        requiredScopes: new Set(['repo', new Set(['project', 'read:project'])]),
      });

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
      const project = await getProject({
        id: projectId,
        octokit,
        gitHubEnterpriseServerVersion,
      });
      logger.info(`Successfully fetched project "${project.title}"`);

      logger.info(`Fetching project items...`);
      const projectItems = await getProjectItems({ id: projectId, octokit, logger });
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

      await posthog.shutdown();
      process.exit(0);
    }),
  );

export default command;
