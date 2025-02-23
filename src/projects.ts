import { Octokit } from 'octokit';

export enum ProjectOwnerType {
  Organization = 'organization',
  User = 'user',
}

export const getGlobalIdAndUrlForProject = async ({
  owner,
  ownerType,
  number,
  octokit,
}: {
  owner: string;
  ownerType: ProjectOwnerType;
  number: number;
  octokit: Octokit;
}): Promise<{ globalId: string; url: string }> => {
  switch (ownerType) {
    case ProjectOwnerType.Organization:
      return await getGlobalIdAndUrlForOrganizationOwnedProject({
        organization: owner,
        number,
        octokit,
      });
    case ProjectOwnerType.User:
      return await getGlobalIdForUserOwnedProject({
        user: owner,
        number,
        octokit,
      });
  }
};

const getGlobalIdAndUrlForOrganizationOwnedProject = async ({
  organization,
  number,
  octokit,
}: {
  organization: string;
  number: number;
  octokit: Octokit;
}): Promise<{ globalId: string; url: string }> => {
  const response = (await octokit.graphql(
    `query getProjectGlobalId($organization: String!, $number: Int!) {
      organization(login: $organization) {
        projectV2(number: $number) {
          id
          url
        }
      }
    }`,
    {
      organization,
      number,
    },
  )) as { organization: { projectV2: { id: string; url: string } } };

  return {
    globalId: response.organization.projectV2.id,
    url: response.organization.projectV2.url,
  };
};

const getGlobalIdForUserOwnedProject = async ({
  user,
  number,
  octokit,
}: {
  user: string;
  number: number;
  octokit: Octokit;
}): Promise<{ globalId: string; url: string }> => {
  const response = (await octokit.graphql(
    `query getProjectGlobalId($user: String!, $number: Int!) {
      user(login: $user) {
        projectV2(number: $number) {
          id
          url
        }
      }
    }`,
    {
      user,
      number,
    },
  )) as { user: { projectV2: { id: string; url: string } } };

  return { globalId: response.user.projectV2.id, url: response.user.projectV2.url };
};
