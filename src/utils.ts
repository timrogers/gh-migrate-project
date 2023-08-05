import { type Octokit } from 'octokit';
import { RequestError } from '@octokit/request-error';
import { GraphqlResponseError } from '@octokit/graphql';
import type winston from 'winston';
import chalk from 'chalk';

export const logRateLimitInformation = async (
  logger: winston.Logger,
  octokit: Octokit,
): Promise<void> => {
  try {
    const graphqlRateLimitResponse = (await octokit.graphql(
      'query { rateLimit { limit remaining resetAt } }',
    )) as { rateLimit: { limit: number; remaining: number; resetAt: string } };
    const graphqlUsedRateLimit =
      graphqlRateLimitResponse.rateLimit.limit -
      graphqlRateLimitResponse.rateLimit.remaining;

    logger.info(
      `GitHub GraphQL rate limit: ${graphqlUsedRateLimit}/${graphqlRateLimitResponse.rateLimit.limit} used - resets at ${graphqlRateLimitResponse.rateLimit.resetAt}`,
    );
  } catch (e) {
    logger.error(`Error checking GitHub rate limit: ${presentError(e)}`);
  }
};

export const presentError = (e: any): string => {
  if (typeof e === 'string') return e;
  if (e instanceof RequestError) return e.message;
  if (e instanceof GraphqlResponseError) return e.message;
  return JSON.stringify(e);
};

const actionErrorHandler = (error: Error): void => {
  console.error(chalk.red(error.message));
  process.exit(1);
};

export const actionRunner = (fn: (...args: any[]) => Promise<any>) => {
  return async (...args: any[]) => await fn(...args).catch(actionErrorHandler);
};
