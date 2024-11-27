import { type Octokit } from 'octokit';
import { RequestError } from '@octokit/request-error';
import { GraphqlResponseError } from '@octokit/graphql';
import chalk from 'chalk';
import semver from 'semver';
import { Logger } from './logger';
import VERSION from './version.js';
import { createOctokit } from './octokit.js';

// Validates the OAuth scopes of the token used to authenticate the user. If the token is a
// scopeless token using fine-grained permissions (e.g. a GitHub App token), the validation
// will be a no-op.
//
// The `requiredScopes` parameter is a Set, where each item in the Set can be either:
// - a string representing a single required scope, which must be present
// - an Set of strings, where at least one of the scopes must be present
export const validateTokenOAuthScopes = async ({
  octokit,
  requiredScopes,
  logger,
}: {
  octokit: Octokit;
  requiredScopes: Set<string | Set<string>>;
  logger: Logger;
}): Promise<void> => {
  const { headers } = await octokit.request('GET /meta');

  // When authenticating using a token with fine-grained permissions, no `x-oauth-scopes`
  // header is returned and we can't perform the validation
  if (!headers['x-oauth-scopes']) {
    logger.info(
      'Skipped GitHub token permissions validation because your token uses fine-grained permissions (FGPs) instead of OAuth scopes. You may encounter issues if your token does not have the required permissions.',
    );
    return;
  }

  const presentScopes: Set<string> = new Set(headers['x-oauth-scopes'].split(', '));

  for (const requiredScopeOrScopes of requiredScopes) {
    validateScopeIsPresent(requiredScopeOrScopes, presentScopes);
  }

  logger.info('Successfully validated GitHub token permissions');
};

const generateScopesListString = (scopes: Set<string>): string =>
  Array.from(scopes)
    .map((scope) => `'${scope}'`)
    .join(', ');

const validateSingleScopePresent = (
  requiredScope: string,
  presentScopes: Set<string>,
): void => {
  const presentScopesString = generateScopesListString(presentScopes);

  if (!presentScopes.has(requiredScope)) {
    throw new Error(
      `Your token does not have the required '${requiredScope}' scope. The following scopes are present: ${presentScopesString}. Please create a token with the correct scopes, and try again.`,
    );
  }
};

const validateAtLeastOneScopePresent = (
  scopes: Set<string>,
  presentScopes: Set<string>,
): void => {
  const requiredScopesString = generateScopesListString(scopes);
  const presentScopesString = generateScopesListString(presentScopes);

  if (Array.from(scopes).every((scope) => !presentScopes.has(scope))) {
    throw new Error(
      `Your token must have at least one of the following scopes: ${requiredScopesString}. The following scopes are present: ${presentScopesString}. Please create a token with the correct scopes, and try again.`,
    );
  }
};

const validateScopeIsPresent = (
  requiredScopeOrScopes: string | Set<string>,
  presentScopes: Set<string>,
): void => {
  if (typeof requiredScopeOrScopes === 'string') {
    validateSingleScopePresent(requiredScopeOrScopes, presentScopes);
  } else {
    validateAtLeastOneScopePresent(requiredScopeOrScopes, presentScopes);
  }
};

export const checkForUpdates = async (
  proxyUrl: string | undefined,
  logger: Logger,
): Promise<void> => {
  const octokit = createOctokit(undefined, 'https://api.github.com', proxyUrl, logger);

  try {
    const { data: release } = await octokit.rest.repos.getLatestRelease({
      owner: 'timrogers',
      repo: 'gh-migrate-project',
    });

    if (semver.gt(release.tag_name, VERSION)) {
      logger.warn(
        `The version of gh-migrate-project you're running, v${VERSION}, is out of date. You can update to the latest version, ${release.tag_name} by running \`gh extension upgrade timrogers/gh-migrate-project\`.`,
      );
    } else {
      logger.info(
        `You are running the latest version of gh-migrate-project, v${VERSION}.`,
      );
    }
  } catch (e) {
    logger.error(`Error checking for updates: ${presentError(e)}`);
  }
};

export const logRateLimitInformation = async (
  logger: Logger,
  octokit: Octokit,
): Promise<boolean> => {
  try {
    const graphqlRateLimitResponse = (await octokit.graphql(
      'query { rateLimit { limit remaining resetAt } }',
    )) as { rateLimit?: { limit: number; remaining: number; resetAt: string } };
    if (graphqlRateLimitResponse.rateLimit) {
      const graphqlUsedRateLimit =
        graphqlRateLimitResponse.rateLimit.limit -
        graphqlRateLimitResponse.rateLimit.remaining;

      logger.info(
        `GitHub GraphQL rate limit: ${graphqlUsedRateLimit}/${graphqlRateLimitResponse.rateLimit.limit} used - resets at ${graphqlRateLimitResponse.rateLimit.resetAt}`,
      );

      return true;
    } else {
      logger.info(`GitHub rate limit is disabled.`);
      return false;
    }
  } catch (e) {
    logger.error(`Error checking GitHub rate limit: ${presentError(e)}`);
    return true;
  }
};

export const presentError = (e: unknown): string => {
  if (typeof e === 'string') return e;
  if (e instanceof RequestError) return e.message;
  if (e instanceof GraphqlResponseError) return e.message;
  return JSON.stringify(e);
};

const actionErrorHandler = (error: Error): void => {
  console.error(chalk.red(error.message));
  console.error(error.stack);
  process.exit(1);
};

// @ts-expect-error - This is a hack to make the actionRunner function work
export const actionRunner = (fn: (...args) => Promise<void>) => {
  //@ts-expect-error - This is a hack to make the actionRunner function work
  return async (...args) => await fn(...args).catch(actionErrorHandler);
};

export const normalizeBaseUrl = (baseUrl: string, logger: Logger): string => {
  if (baseUrl.endsWith('/')) {
    const normalizedBaseUrl = baseUrl.slice(0, -1);
    logger.info(
      `Automatically removing trailing slash from base URL - base URL is now ${normalizedBaseUrl}`,
    );
    return normalizedBaseUrl;
  }

  return baseUrl;
};
