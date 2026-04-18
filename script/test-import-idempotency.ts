/*
 * Integration test for the idempotent handling of project items that
 * already exist in the target project (e.g. items added by the
 * `Auto-add sub-issues to project` workflow before the import gets to
 * them).
 *
 * This script verifies the GraphQL contract that `addItemToProject`
 * (in src/commands/import.ts) relies on:
 *   1. Adding the same content to a project twice produces a
 *      `GraphqlResponseError` whose message contains
 *      `Content already exists in this project`.
 *   2. The `projectItems` connection on the content can be used to
 *      look up the existing project item ID for the target project.
 *
 * It creates a temporary ProjectV2 in the sandbox organization,
 * exercises the scenario, and deletes the project at the end (also on
 * failure).
 */

import { Octokit } from 'octokit';
import { GraphqlResponseError } from '@octokit/graphql';

const ORGANIZATION_LOGIN = 'gh-migrate-project-sandbox';
const SOURCE_REPOSITORY = 'gh-migrate-project-sandbox/initial-repository';
const PROJECT_TITLE = `idempotency-test-${Date.now()}`;
const EXPECTED_ERROR_FRAGMENT = 'Content already exists in this project';

const token = process.env.GITHUB_TOKEN;

if (!token) {
  console.error('GITHUB_TOKEN environment variable must be set.');
  process.exit(1);
}

const octokit = new Octokit({ auth: token });

const getOrganizationId = async (login: string): Promise<string> => {
  const response = (await octokit.graphql(
    `query getOrganization($login: String!) {
      organization(login: $login) { id }
    }`,
    { login },
  )) as { organization: { id: string } };

  return response.organization.id;
};

const getFirstIssue = async (
  nameWithOwner: string,
): Promise<{ id: string; number: number }> => {
  const [owner, name] = nameWithOwner.split('/');

  const response = (await octokit.graphql(
    `query getFirstIssue($owner: String!, $name: String!) {
      repository(owner: $owner, name: $name) {
        issues(first: 1, states: [OPEN, CLOSED], orderBy: { field: CREATED_AT, direction: ASC }) {
          nodes { id number }
        }
      }
    }`,
    { owner, name },
  )) as { repository: { issues: { nodes: { id: string; number: number }[] } } };

  const issue = response.repository.issues.nodes[0];

  if (!issue) {
    throw new Error(`No issue found in ${nameWithOwner} to use for the test.`);
  }

  return issue;
};

const createProject = async (
  ownerId: string,
  title: string,
): Promise<{ id: string; url: string }> => {
  const response = (await octokit.graphql(
    `mutation createProject($ownerId: ID!, $title: String!) {
      createProjectV2(input: { ownerId: $ownerId, title: $title }) {
        projectV2 { id url }
      }
    }`,
    { ownerId, title },
  )) as { createProjectV2: { projectV2: { id: string; url: string } } };

  return response.createProjectV2.projectV2;
};

const addItemToProject = async (
  projectId: string,
  contentId: string,
): Promise<string> => {
  const response = (await octokit.graphql(
    `mutation addItem($projectId: ID!, $contentId: ID!) {
      addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
        item { id }
      }
    }`,
    { projectId, contentId },
  )) as { addProjectV2ItemById: { item: { id: string } } };

  return response.addProjectV2ItemById.item.id;
};

const findExistingProjectItemId = async (
  projectId: string,
  contentId: string,
): Promise<string | undefined> => {
  const response = (await octokit.graphql(
    `query getProjectItemsForContent($contentId: ID!) {
      node(id: $contentId) {
        ... on Issue {
          projectItems(first: 100, includeArchived: true) {
            nodes { id project { id } }
          }
        }
        ... on PullRequest {
          projectItems(first: 100, includeArchived: true) {
            nodes { id project { id } }
          }
        }
      }
    }`,
    { contentId },
  )) as {
    node: {
      projectItems?: { nodes: Array<{ id: string; project: { id: string } }> };
    } | null;
  };

  const nodes = response.node?.projectItems?.nodes ?? [];
  return nodes.find((node) => node.project.id === projectId)?.id;
};

const deleteProject = async (projectId: string): Promise<void> => {
  await octokit.graphql(
    `mutation deleteProject($projectId: ID!) {
      deleteProjectV2(input: { projectId: $projectId }) { projectV2 { id } }
    }`,
    { projectId },
  );
};

const run = async (): Promise<void> => {
  console.log(`Resolving organization ID for ${ORGANIZATION_LOGIN}...`);
  const ownerId = await getOrganizationId(ORGANIZATION_LOGIN);

  console.log(`Fetching an issue from ${SOURCE_REPOSITORY}...`);
  const issue = await getFirstIssue(SOURCE_REPOSITORY);
  console.log(`Using issue #${issue.number} (${issue.id})`);

  console.log(`Creating temporary project "${PROJECT_TITLE}"...`);
  const project = await createProject(ownerId, PROJECT_TITLE);
  console.log(`Created project ${project.id} (${project.url})`);

  let failure: Error | undefined;

  try {
    console.log('Adding issue to project (first attempt should succeed)...');
    const firstItemId = await addItemToProject(project.id, issue.id);
    console.log(`Added project item ${firstItemId}`);

    console.log(
      'Adding the same issue to the project again (should fail with the expected error)...',
    );
    let duplicateError: unknown;

    try {
      await addItemToProject(project.id, issue.id);
    } catch (e) {
      duplicateError = e;
    }

    if (!duplicateError) {
      throw new Error(
        'Expected adding duplicate content to fail, but the mutation succeeded.',
      );
    }

    if (!(duplicateError instanceof GraphqlResponseError)) {
      throw new Error(`Expected a GraphqlResponseError, got: ${String(duplicateError)}`);
    }

    if (!duplicateError.message.includes(EXPECTED_ERROR_FRAGMENT)) {
      throw new Error(
        `Expected error message to include "${EXPECTED_ERROR_FRAGMENT}", got: ${duplicateError.message}`,
      );
    }

    console.log(
      `Got the expected GraphqlResponseError containing "${EXPECTED_ERROR_FRAGMENT}".`,
    );

    console.log(
      'Looking up the existing project item ID via the projectItems connection...',
    );
    const existingItemId = await findExistingProjectItemId(project.id, issue.id);

    if (!existingItemId) {
      throw new Error(
        'Expected to find an existing project item ID for the content, but got none.',
      );
    }

    if (existingItemId !== firstItemId) {
      throw new Error(
        `Expected lookup to return ${firstItemId}, but got ${existingItemId}.`,
      );
    }

    console.log(`Lookup returned the expected project item ID ${existingItemId}.`);
    console.log('Idempotency contract test passed.');
  } catch (e) {
    failure = e instanceof Error ? e : new Error(String(e));
  } finally {
    console.log(`Deleting temporary project ${project.id}...`);
    try {
      await deleteProject(project.id);
      console.log('Deleted temporary project.');
    } catch (cleanupError) {
      console.error(
        `Failed to delete temporary project ${project.id}: ${String(cleanupError)}`,
      );
    }
  }

  if (failure) {
    console.error(`Idempotency contract test failed: ${failure.message}`);
    process.exit(1);
  }
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
