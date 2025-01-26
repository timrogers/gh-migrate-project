import type { Octokit } from 'npm:octokit';
import { parse, SemVer } from 'jsr:@std/semver';

// Octokit's default types target GitHub.com where there is no `installed_version` returned
// from this API. We construct our own type which includes this.
type GhesMetaResponse = {
  data: {
    verifiable_password_authentication: boolean;
    ssh_key_fingerprints?: {
      SHA256_RSA?: string;
      SHA256_DSA?: string;
      SHA256_ECDSA?: string;
      SHA256_ED25519?: string;
    };
    /**
     * @example [
     *   "ssh-ed25519 ABCDEFGHIJKLMNOPQRSTUVWXYZ"
     * ]
     */
    ssh_keys?: string[];
    /**
     * @example [
     *   "192.0.2.1"
     * ]
     */
    hooks?: string[];
    /**
     * @example [
     *   "192.0.2.1"
     * ]
     */
    github_enterprise_importer?: string[];
    /**
     * @example [
     *   "192.0.2.1"
     * ]
     */
    web?: string[];
    /**
     * @example [
     *   "192.0.2.1"
     * ]
     */
    api?: string[];
    /**
     * @example [
     *   "192.0.2.1"
     * ]
     */
    git?: string[];
    /**
     * @example [
     *   "192.0.2.1"
     * ]
     */
    packages?: string[];
    /**
     * @example [
     *   "192.0.2.1"
     * ]
     */
    pages?: string[];
    /**
     * @example [
     *   "192.0.2.1"
     * ]
     */
    importer?: string[];
    /**
     * @example [
     *   "192.0.2.1"
     * ]
     */
    actions?: string[];
    /**
     * @example [
     *   "192.0.2.1"
     * ]
     */
    actions_macos?: string[];
    /**
     * @example [
     *   "192.0.2.1"
     * ]
     */
    codespaces?: string[];
    /**
     * @example [
     *   "192.0.2.1"
     * ]
     */
    dependabot?: string[];
    /**
     * @example [
     *   "192.0.2.1"
     * ]
     */
    copilot?: string[];
    domains?: {
      website?: string[];
      codespaces?: string[];
      copilot?: string[];
      packages?: string[];
      actions?: string[];
      actions_inbound?: {
        full_domains?: string[];
        wildcard_domains?: string[];
      };
      artifact_attestations?: {
        /**
         * @example [
         *   "example"
         * ]
         */
        trust_domain?: string;
        services?: string[];
      };
    };
    installed_version: string;
  };
};

export const MINIMUM_SUPPORTED_GITHUB_ENTERPRISE_SERVER_VERSION_FOR_EXPORTS =
  parse('3.12.0');

export const MINIMUM_SUPPORTED_GITHUB_ENTERPRISE_SERVER_VERSION_FOR_IMPORTS =
  parse('3.12.0');

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
      gitHubEnterpriseServerVersion: SemVer;
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

const getGitHubEnterpriseServerVersion = async (octokit: Octokit): Promise<SemVer> => {
  const {
    data: { installed_version },
  } = (await octokit.rest.meta.get()) as unknown as GhesMetaResponse;

  return parse(installed_version);
};
