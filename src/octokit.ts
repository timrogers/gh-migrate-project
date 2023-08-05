import { Octokit } from 'octokit';
import { paginateGraphql } from '@octokit/plugin-paginate-graphql';

const OctokitWithPaginateGraphql = Octokit.plugin(paginateGraphql);

export const createOctokit = (token: string, baseUrl: string): Octokit =>
  new OctokitWithPaginateGraphql({ auth: token, baseUrl, fetch });
