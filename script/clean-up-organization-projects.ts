import { Octokit } from 'octokit';
import { paginateGraphQL } from '@octokit/plugin-paginate-graphql';

const getAllOrganizationOwnedProjects = async ({
  login,
  octokit,
}: {
  login: string;
  octokit: Octokit;
}): Promise<{ id: string; number: number }[]> => {
  const response = (await octokit.graphql.paginate(
    `query getAllOrganizationOwnedProjectIds($login: String!, $cursor: String) {
      organization(login: $login) {
        projectsV2(first: 100, after: $cursor) {
          nodes {
            id
            number
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    }`,
    {
      login,
    },
  )) as { organization: { projectsV2: { nodes: { id: string; number: number }[] } } };

  return response.organization.projectsV2.nodes;
};

const OctokitWithPaginateGraphQL = Octokit.plugin(paginateGraphQL);
const octokit = new OctokitWithPaginateGraphQL({ auth: process.env.GITHUB_TOKEN });

const ORGANIZATION_LOGIN = 'gh-migrate-project-sandbox';
const SKIPPED_PROJECT_NUMBERS = [1026];

(async () => {
  console.log(`Fetching all projects for organization ${ORGANIZATION_LOGIN}...`);

  const projects = await getAllOrganizationOwnedProjects({
    octokit,
    login: ORGANIZATION_LOGIN,
  });

  console.log(
    `Found ${projects.length} projects belonging to organization ${ORGANIZATION_LOGIN}`,
  );

  const projectsToDelete = projects.filter(
    (project) => !SKIPPED_PROJECT_NUMBERS.includes(project.number),
  );

  console.log(`Found ${projectsToDelete.length} projects eligible for deletion`);

  for (const { id: projectId, number: projectNumber } of projectsToDelete) {
    console.log(`Deleting project ${projectNumber} (${projectId})...`);

    try {
      await octokit.graphql(
        `mutation deleteProject($projectId: ID!) {
          deleteProjectV2(input: { projectId: $projectId }) {
            projectV2 {
              id
            }
          }
        }`,
        {
          projectId,
        },
      );

      console.log(`Deleted project ${projectNumber} (${projectId})`);
    } catch (e) {
      console.error(`Error deleting project ${projectNumber} (${projectId}): ${e}`);
    }
  }
})();
