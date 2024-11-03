import { program } from 'commander';
import { type Octokit as OctokitType } from 'octokit';
import { createOctokit } from '../src/octokit';
import { createLogger } from '../src/logger';
import { GraphqlResponseError } from '@octokit/graphql';

const createOrganization = async ({
  login,
  octokit,
}: {
  login: string;
  octokit: OctokitType;
}): Promise<number> => {
  const {
    data: { id },
  } = (await octokit.request('POST /admin/organizations', {
    login: login,
    admin: 'ghe-admin',
  })) as { data: { id: number } };

  return id;
};

const isOrganizationAlreadyCreated = async ({
  login,
  octokit,
}: {
  login: string;
  octokit: OctokitType;
}): Promise<boolean> => {
  try {
    await octokit.graphql(
      `query getOrganization($login: String!) {
        organization(login: $login) {
          id
        }
      }`,
      {
        login,
      },
    );

    return true;
  } catch (e) {
    if (
      e instanceof GraphqlResponseError &&
      e.errors &&
      e.errors.length &&
      e.errors[0].type === 'NOT_FOUND'
    ) {
      return false;
    } else {
      throw e;
    }
  }
};

const createRepository = async ({
  organizationLogin,
  name,
  octokit,
}: {
  organizationLogin: string;
  name: string;
  octokit: OctokitType;
}): Promise<number> => {
  const {
    data: { id },
  } = (await octokit.request('POST /orgs/{org}/repos', {
    org: organizationLogin,
    name: name,
  })) as { data: { id: number } };

  return id;
};

const isRepositoryAlreadyCreated = async ({
  organizationLogin,
  name,
  octokit,
}: {
  organizationLogin: string;
  name: string;
  octokit: OctokitType;
}): Promise<boolean> => {
  try {
    // Look up a GitHub repository using GraphQL
    await octokit.graphql(
      `query getRepository($owner: String!, $name: String!) {
        repository(owner: $owner, name: $name) {
          id
        }
      }`,
      {
        owner: organizationLogin,
        name,
      },
    );

    return true;
  } catch (e) {
    if (
      e instanceof GraphqlResponseError &&
      e.errors &&
      e.errors.length &&
      e.errors[0].type === 'NOT_FOUND'
    ) {
      return false;
    } else {
      throw e;
    }
  }
};

const isIssueAlreadyCreated = async ({
  organizationLogin,
  repositoryName,
  issueNumber,
  octokit,
}: {
  organizationLogin: string;
  repositoryName: string;
  issueNumber: number;
  octokit: OctokitType;
}): Promise<boolean> => {
  try {
    await octokit.graphql(
      `query getIssue($owner: String!, $name: String!, $number: Int!) {
        repository(owner: $owner, name: $name) {
          issue(number: $number) {
            id
          }
        }
      }`,
      {
        owner: organizationLogin,
        name: repositoryName,
        number: issueNumber,
      },
    );

    return true;
  } catch (e) {
    if (
      e instanceof GraphqlResponseError &&
      e.errors &&
      e.errors.length &&
      e.errors[0].type === 'NOT_FOUND'
    ) {
      return false;
    } else {
      throw e;
    }
  }
};

const createIssue = async ({
  organizationLogin,
  repositoryName,
  title,
  octokit,
}: {
  organizationLogin: string;
  repositoryName: string;
  title: string;
  octokit: OctokitType;
}): Promise<number> => {
  const {
    data: { id },
  } = (await octokit.request('POST /repos/{owner}/{repo}/issues', {
    owner: organizationLogin,
    repo: repositoryName,
    title,
  })) as { data: { id: number } };

  return id;
};

const INTEGRATION_TEST_ORGANIZATION_LOGIN = 'gh-migrate-project-sandbox';
const INTEGRATION_TEST_REPOSITORY_NAME = 'initial-repository';

program
  .requiredOption(
    '--ghes-base-url <ghesBaseUrl>',
    'The base URL of the GitHub Enterprise Server (GHES) instance (e.g. `https://ghes.acme.corp/api/v3`)',
  )
  .option(
    '--ghes-access-token <ghesAccessToken>',
    'The access token for the GitHub Enterprise Server (GHES) instance. This can also be set using the $GHES_TOKEN environment variable.',
  )
  .option(
    '--dotcom-access-token <dotcomAccessToken>',
    'The access token for GitHub.com. This can also be set using the $GITHUB_TOKEN environment variable.',
  )
  .option('--verbose', 'Emit detailed, verbose logs', false);

program.parse(process.argv);

const opts = program.opts() as {
  ghesBaseUrl: string;
  ghesAccessToken?: string;
  dotcomAccessToken?: string;
  verbose: boolean;
};

(async () => {
  const logger = createLogger(opts.verbose);

  const octokit = createOctokit(
    opts.ghesAccessToken,
    opts.ghesBaseUrl,
    undefined,
    logger,
  );

  logger.info('Seeding GHES instance...');

  if (
    !(await isOrganizationAlreadyCreated({
      login: INTEGRATION_TEST_ORGANIZATION_LOGIN,
      octokit,
    }))
  ) {
    logger.info(`Creating organization ${INTEGRATION_TEST_ORGANIZATION_LOGIN}...`);

    const organizationId = await createOrganization({
      login: INTEGRATION_TEST_ORGANIZATION_LOGIN,
      octokit,
    });

    logger.info(
      `Created organization ${INTEGRATION_TEST_ORGANIZATION_LOGIN} with ID ${organizationId}`,
    );
  }

  if (
    !(await isRepositoryAlreadyCreated({
      organizationLogin: INTEGRATION_TEST_ORGANIZATION_LOGIN,
      name: INTEGRATION_TEST_REPOSITORY_NAME,
      octokit,
    }))
  ) {
    logger.info(
      `Creating repository ${INTEGRATION_TEST_REPOSITORY_NAME} in organization ${INTEGRATION_TEST_ORGANIZATION_LOGIN}...`,
    );

    const repositoryId = await createRepository({
      organizationLogin: INTEGRATION_TEST_ORGANIZATION_LOGIN,
      name: INTEGRATION_TEST_REPOSITORY_NAME,
      octokit,
    });

    logger.info(
      `Created repository ${INTEGRATION_TEST_REPOSITORY_NAME} in organization ${INTEGRATION_TEST_ORGANIZATION_LOGIN} with ID ${repositoryId}`,
    );
  }

  if (
    !(await isIssueAlreadyCreated({
      organizationLogin: INTEGRATION_TEST_ORGANIZATION_LOGIN,
      repositoryName: INTEGRATION_TEST_REPOSITORY_NAME,
      issueNumber: 1,
      octokit,
    }))
  ) {
    logger.info(
      `Creating issue #1 in repository ${INTEGRATION_TEST_REPOSITORY_NAME} in organization ${INTEGRATION_TEST_ORGANIZATION_LOGIN}...`,
    );

    const issueId = await createIssue({
      organizationLogin: INTEGRATION_TEST_ORGANIZATION_LOGIN,
      repositoryName: INTEGRATION_TEST_REPOSITORY_NAME,
      title: 'A crucial issue',
      octokit,
    });

    logger.info(
      `Created issue #1 in repository ${INTEGRATION_TEST_REPOSITORY_NAME} in organization ${INTEGRATION_TEST_ORGANIZATION_LOGIN} with ID ${issueId}`,
    );
  }

  console.log('Done!');
})();
