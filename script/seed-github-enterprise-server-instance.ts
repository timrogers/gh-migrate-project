import { type Octokit as OctokitType } from 'octokit';
import { Octokit } from 'octokit';
import { GraphqlResponseError } from '@octokit/graphql';

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

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
  baseUrl: process.env.GITHUB_BASE_URL,
});

const ORGANIZATION_LOGIN = 'gh-migrate-project-sandbox';
const REPOSITORY_NAME = 'initial-repository';

(async () => {
  if (!(await isOrganizationAlreadyCreated({ login: ORGANIZATION_LOGIN, octokit }))) {
    console.log(`Creating organization ${ORGANIZATION_LOGIN}...`);

    const organizationId = await createOrganization({
      login: ORGANIZATION_LOGIN,
      octokit,
    });

    console.log(`Created organization ${ORGANIZATION_LOGIN} with ID ${organizationId}`);
  }

  if (
    !(await isRepositoryAlreadyCreated({
      organizationLogin: ORGANIZATION_LOGIN,
      name: REPOSITORY_NAME,
      octokit,
    }))
  ) {
    console.log(
      `Creating repository ${REPOSITORY_NAME} in organization ${ORGANIZATION_LOGIN}...`,
    );

    const repositoryId = await createRepository({
      organizationLogin: ORGANIZATION_LOGIN,
      name: REPOSITORY_NAME,
      octokit,
    });

    console.log(
      `Created repository ${REPOSITORY_NAME} in organization ${ORGANIZATION_LOGIN} with ID ${repositoryId}`,
    );
  }

  if (
    !(await isIssueAlreadyCreated({
      organizationLogin: ORGANIZATION_LOGIN,
      repositoryName: REPOSITORY_NAME,
      issueNumber: 1,
      octokit,
    }))
  ) {
    console.log(
      `Creating issue #1 in repository ${REPOSITORY_NAME} in organization ${ORGANIZATION_LOGIN}...`,
    );

    const issueId = await createIssue({
      organizationLogin: ORGANIZATION_LOGIN,
      repositoryName: REPOSITORY_NAME,
      title: 'A crucial issue',
      octokit,
    });

    console.log(
      `Created issue #1 in repository ${REPOSITORY_NAME} in organization ${ORGANIZATION_LOGIN} with ID ${issueId}`,
    );
  }

  console.log('Done!');
})();
