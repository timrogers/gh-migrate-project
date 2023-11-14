import { fetch as undiciFetch, ProxyAgent, RequestInfo, RequestInit } from 'undici';
import { Octokit, RequestError } from 'octokit';
import { paginateGraphql } from '@octokit/plugin-paginate-graphql';

import { Logger } from './logger';

const OctokitWithPaginateGraphql = Octokit.plugin(paginateGraphql);

export const createOctokit = (
  token: string,
  baseUrl: string,
  proxyUrl: string | undefined,
  logger: Logger,
): Octokit => {
  const customFetch = (url: RequestInfo, options: RequestInit) => {
    return undiciFetch(url, {
      ...options,
      dispatcher: proxyUrl ? new ProxyAgent(proxyUrl) : undefined,
    });
  };

  const octokit = new OctokitWithPaginateGraphql({
    auth: token,
    baseUrl,
    request: { fetch: customFetch },
  });

  octokit.hook.after('request', async (response, options) => {
    logger.debug(`${options.method} ${options.url}: ${response.status}`);
  });

  octokit.hook.error('request', async (error, options) => {
    if (error instanceof RequestError) {
      logger.debug(
        `${options.method} ${options.url}: ${error.status} - ${error.message}`,
      );
    } else {
      logger.debug(`${options.method} ${options.url}: ${error.name} - ${error.message}`);
    }

    throw error;
  });

  return octokit;
};
