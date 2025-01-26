import { program } from 'commander';
import _sodium from 'libsodium-wrappers';
import { parse } from 'jsr:@std/semver';
import { type Octokit as OctokitType } from 'octokit';
import { createOctokit } from '../src/octokit';
import { createLogger } from '../src/logger';
import { GraphqlResponseError } from '@octokit/graphql';
import { getGitHubProductInformation, GitHubProduct } from '../src/github-products';

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

const encryptSecretValue = ({
  sodium,
  key,
  secretValue,
}: {
  sodium: typeof _sodium;
  key: string;
  secretValue: string;
}): string => {
  const binKey = sodium.from_base64(key, sodium.base64_variants.ORIGINAL);
  const binSecretValue = sodium.from_string(secretValue);
  const encryptedSecretValue = sodium.to_base64(
    sodium.crypto_box_seal(binSecretValue, binKey),
    sodium.base64_variants.ORIGINAL,
  );

  return encryptedSecretValue;
};

const encryptAndSetActionsSecret = async ({
  octokit,
  owner,
  repo,
  sodium,
  secretName,
  secretValue,
}: {
  octokit: OctokitType;
  owner: string;
  repo: string;
  sodium: typeof _sodium;
  secretName: string;
  secretValue: string;
}) => {
  const {
    data: { key_id: keyId, key },
  } = await octokit.request('GET /repos/{owner}/{repo}/actions/secrets/public-key', {
    owner: owner,
    repo: repo,
  });

  const encryptedSecretValue = encryptSecretValue({ sodium, key, secretValue });

  await octokit.request('PUT /repos/{owner}/{repo}/actions/secrets/{secret_name}', {
    owner,
    repo,
    secret_name: secretName,
    encrypted_value: encryptedSecretValue,
    key_id: keyId,
  });
};

const encryptAndSetDependabotSecret = async ({
  octokit,
  owner,
  repo,
  sodium,
  secretName,
  secretValue,
}: {
  octokit: OctokitType;
  owner: string;
  repo: string;
  sodium: typeof _sodium;
  secretName: string;
  secretValue: string;
}) => {
  const {
    data: { key_id: keyId, key },
  } = await octokit.request('GET /repos/{owner}/{repo}/dependabot/secrets/public-key', {
    owner: owner,
    repo: repo,
  });

  const encryptedSecretValue = encryptSecretValue({ sodium, key, secretValue });

  await octokit.request('PUT /repos/{owner}/{repo}/dependabot/secrets/{secret_name}', {
    owner,
    repo,
    secret_name: secretName,
    encrypted_value: encryptedSecretValue,
    key_id: keyId,
  });
};

const PROJECT_OWNER = 'timrogers';
const PROJECT_REPO = 'gh-migrate-project';
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
  ghesAccessToken: string;
  dotcomAccessToken: string;
  verbose: boolean;
};

(async () => {
  await _sodium.ready;
  const sodium = _sodium;

  const logger = createLogger(opts.verbose);

  const ghesAccessToken = opts.ghesAccessToken || process.env.GHES_TOKEN;

  if (!ghesAccessToken) {
    logger.error(
      'No GitHub Enterprise Server token provided - set --ghes-access-token or $GHES_TOKEN',
    );
    process.exit(1);
  }

  const dotcomAccessToken = opts.dotcomAccessToken || process.env.GITHUB_TOKEN;

  if (!dotcomAccessToken) {
    logger.error(
      'No GitHub.com token provided - set --dotcom-access-token or $GITHUB_TOKEN',
    );
    process.exit(1);
  }

  const octokit = createOctokit(ghesAccessToken, opts.ghesBaseUrl, undefined, logger);

  const githubProductInformation = await getGitHubProductInformation(octokit);

  if (githubProductInformation.githubProduct !== GitHubProduct.GHES) {
    throw new Error(
      `Expected ${opts.ghesBaseUrl} to be a GitHub Enterprise Server instance`,
    );
  }

  const parsedGhesVersion = parse(githubProductInformation.gitHubEnterpriseServerVersion);

  if (!parsedGhesVersion) {
    throw new Error(
      `Failed to parse GitHub Enterprise Server version: ${githubProductInformation.gitHubEnterpriseServerVersion}`,
    );
  }

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

  logger.info('Finished seeding GHES instance');
  logger.info('Configuring GitHub Actions and Dependabot secrets...');

  const ghesVersionForSecretName = `${parsedGhesVersion.major}${parsedGhesVersion.minor}`;

  const dotcomOctokit = createOctokit(
    dotcomAccessToken,
    'https://api.github.com',
    undefined,
    logger,
  );

  await encryptAndSetActionsSecret({
    octokit: dotcomOctokit,
    owner: PROJECT_OWNER,
    repo: PROJECT_REPO,
    sodium,
    secretName: `GHES_${ghesVersionForSecretName}_ACCESS_TOKEN`,
    secretValue: ghesAccessToken,
  });

  await encryptAndSetDependabotSecret({
    octokit: dotcomOctokit,
    owner: PROJECT_OWNER,
    repo: PROJECT_REPO,
    sodium,
    secretName: `GHES_${ghesVersionForSecretName}_ACCESS_TOKEN`,
    secretValue: ghesAccessToken,
  });

  await encryptAndSetActionsSecret({
    octokit: dotcomOctokit,
    owner: PROJECT_OWNER,
    repo: PROJECT_REPO,
    sodium,
    secretName: `GHES_${ghesVersionForSecretName}_BASE_URL`,
    secretValue: opts.ghesBaseUrl,
  });

  await encryptAndSetDependabotSecret({
    octokit: dotcomOctokit,
    owner: PROJECT_OWNER,
    repo: PROJECT_REPO,
    sodium,
    secretName: `GHES_${ghesVersionForSecretName}_BASE_URL`,
    secretValue: opts.ghesBaseUrl,
  });
})();
