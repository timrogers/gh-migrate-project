import { fetch as undiciFetch, ProxyAgent, RequestInfo, RequestInit } from 'undici';
import { Octokit } from 'octokit';
import { paginateGraphql } from '@octokit/plugin-paginate-graphql';

const OctokitWithPaginateGraphql = Octokit.plugin(paginateGraphql);

export const createOctokit = (
  token: string,
  baseUrl: string,
  proxyUrl: string | undefined,
): Octokit => {
  const customFetch = (url: RequestInfo, options: RequestInit) => {
    return undiciFetch(url, {
      ...options,
      dispatcher: proxyUrl ? new ProxyAgent(proxyUrl) : undefined,
    });
  };

  return new OctokitWithPaginateGraphql({
    auth: token,
    baseUrl,
    request: { fetch: customFetch },
  });
};
