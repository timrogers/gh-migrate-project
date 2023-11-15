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

export const MINIMUM_SUPPORTED_GITHUB_ENTERPRISE_SERVER_VERSION_FOR_EXPORTS = '3.7.0';

export const isSupportedGitHubEnterpriseServerVersionForExports = (version: string) =>
  semver.gte(version, MINIMUM_SUPPORTED_GITHUB_ENTERPRISE_SERVER_VERSION_FOR_EXPORTS);

export const getGitHubProductInformation = async (
  octokit: Octokit,
): Promise<
  | {
      isGitHubEnterpriseServer: true;
      gitHubEnterpriseServerVersion: string;
    }
  | {
      isGitHubEnterpriseServer: false;
      gitHubEnterpriseServerVersion: undefined;
    }
> => {
  const isGitHubEnterpriseServer = isGitHubEnterpriseServerBaseUrl(
    octokit.request.endpoint.DEFAULTS.baseUrl,
  );

  if (isGitHubEnterpriseServer) {
    const gitHubEnterpriseServerVersion = await getGitHubEnterpriseServerVersion(octokit);

    return {
      isGitHubEnterpriseServer,
      gitHubEnterpriseServerVersion,
    };
  } else {
    return {
      isGitHubEnterpriseServer,
      gitHubEnterpriseServerVersion: undefined,
    };
  }
};

const isGitHubEnterpriseServerBaseUrl = (baseUrl: string): boolean =>
  baseUrl !== 'https://api.github.com';

const getGitHubEnterpriseServerVersion = async (octokit: Octokit): Promise<string> => {
  const {
    data: { installed_version },
  } = (await octokit.rest.meta.get()) as GhesMetaResponse;

  return installed_version;
};
