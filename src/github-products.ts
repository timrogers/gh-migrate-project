import type { Octokit } from 'octokit';
import { Endpoints } from '@octokit/types';
import semver from 'semver';

type DotcomMetaResponse = Endpoints['GET /meta']['response'];

// Octokit's default types target GitHub.com where there is no `installed_version` returned
// from this API. We construct our own type which includes this.
type GhesMetaResponse = DotcomMetaResponse & {
  data: {
    installed_version: string;
  };
};

export const MINIMUM_SUPPORTED_GITHUB_ENTERPRISE_SERVER_VERSION_FOR_EXPORTS = '3.14.0';

export const MINIMUM_SUPPORTED_GITHUB_ENTERPRISE_SERVER_VERSION_FOR_IMPORTS = '3.14.0';

export const MINIMUM_SUPPORTED_GITHUB_ENTERPRISE_SERVER_VERSION_FOR_STATUS_FIELD_MIGRATION =
  '3.17.0';

export enum GitHubProduct {
  GHES = 'GitHub Enterprise Server',
  DOTCOM = 'GitHub.com',
  GITHUB_ENTERPRISE_CLOUD_WITH_DATA_RESIDENCY = 'GitHub Enterprise Cloud with Data Residency',
}

export const getGitHubProductInformation = async (
  octokit: Octokit,
): Promise<
  | {
      githubProduct: GitHubProduct.GHES;
      gitHubEnterpriseServerVersion: string;
    }
  | {
      githubProduct:
        | GitHubProduct.DOTCOM
        | GitHubProduct.GITHUB_ENTERPRISE_CLOUD_WITH_DATA_RESIDENCY;
      gitHubEnterpriseServerVersion: undefined;
    }
> => {
  const githubProduct = getGitHubProductFromBaseUrl(
    octokit.request.endpoint.DEFAULTS.baseUrl,
  );

  if (githubProduct === GitHubProduct.GHES) {
    const gitHubEnterpriseServerVersion = await getGitHubEnterpriseServerVersion(octokit);

    return {
      githubProduct,
      gitHubEnterpriseServerVersion,
    };
  } else {
    return {
      githubProduct,
      gitHubEnterpriseServerVersion: undefined,
    };
  }
};

const getGitHubProductFromBaseUrl = (baseUrl: string): GitHubProduct => {
  if (isDotcomBaseUrl(baseUrl)) {
    return GitHubProduct.DOTCOM;
  } else if (isGitHubEnterpriseCloudWithDataResidencyBaseUrl(baseUrl)) {
    return GitHubProduct.GITHUB_ENTERPRISE_CLOUD_WITH_DATA_RESIDENCY;
  } else {
    return GitHubProduct.GHES;
  }
};

const isDotcomBaseUrl = (baseUrl: string): boolean =>
  baseUrl === 'https://api.github.com';

const isGitHubEnterpriseCloudWithDataResidencyBaseUrl = (baseUrl: string): boolean => {
  const { host } = new URL(baseUrl);
  return host.endsWith('ghe.com');
};

const getGitHubEnterpriseServerVersion = async (octokit: Octokit): Promise<string> => {
  const {
    data: { installed_version },
  } = (await octokit.rest.meta.get()) as GhesMetaResponse;

  return installed_version;
};

export const supportsAutomaticStatusFieldMigration = (
  githubProduct: GitHubProduct,
  gitHubEnterpriseServerVersion?: string,
): boolean => {
  // GitHub.com and GitHub Enterprise Cloud with Data Residency always support it
  if (githubProduct !== GitHubProduct.GHES) {
    return true;
  }

  // For GHES, check if version is 3.17.0 or later
  if (!gitHubEnterpriseServerVersion) {
    return false;
  }

  return semver.gte(
    gitHubEnterpriseServerVersion,
    MINIMUM_SUPPORTED_GITHUB_ENTERPRISE_SERVER_VERSION_FOR_STATUS_FIELD_MIGRATION,
  );
};
