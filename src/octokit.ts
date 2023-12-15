import { STATUS_CODES } from 'http';
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
    request: {
      fetch: customFetch,
    },
  });

  octokit.hook.before('request', async (options) => {
    if (options.query) {
      logger.debug(
        `Request: ${options.method} ${options.baseUrl}${options.url} - ${options.query}`,
      );
    } else if (options.method === 'POST') {
      logger.debug(
        `Request: ${options.method} ${options.baseUrl}${options.url} - [request body not logged]`,
      );
    } else {
      logger.debug(`Request: ${options.method} ${options.baseUrl}${options.url}`);
    }
  });

  octokit.hook.after('request', async (response) => {
    logger.debug(
      `Response: ${response.status} ${STATUS_CODES[response.status]} - ${JSON.stringify(
        response.data,
      )}`,
    );
  });

  octokit.hook.error('request', async (error) => {
    if (error instanceof RequestError) {
      logger.debug(
        `Error: ${error.status} ${STATUS_CODES[error.status]}${
          error.response ? ` - ${JSON.stringify(error.response.data)}` : ''
        }`,
      );
    } else {
      logger.debug(`Error: ${error.message}}`);
    }

    throw error;
  });

  return octokit;
};
