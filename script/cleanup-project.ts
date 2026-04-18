/*
 * Cleanup script for the import idempotency end-to-end test. Deletes
 * the temporary ProjectV2 created by `setup-import-idempotency-target.ts`.
 */

import { Octokit } from 'octokit';

interface Args {
  projectOwner: string;
  projectNumber: number;
}

const parseArgs = (): Args => {
  const argv = process.argv.slice(2);
  const out: Partial<Args> = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    switch (arg) {
      case '--project-owner':
        out.projectOwner = next;
        i += 1;
        break;
      case '--project-number':
        out.projectNumber = parseInt(next, 10);
        i += 1;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!out.projectOwner || !out.projectNumber) {
    throw new Error('Required: --project-owner, --project-number');
  }

  return out as Args;
};

(async () => {
  const args = parseArgs();
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('GITHUB_TOKEN environment variable must be set.');
  }

  const octokit = new Octokit({ auth: token });

  console.log(`Resolving project ID for ${args.projectOwner}/#${args.projectNumber}...`);
  let projectId: string | undefined;
  try {
    const orgResponse = (await octokit.graphql(
      `query($login: String!, $number: Int!) {
        organization(login: $login) { projectV2(number: $number) { id } }
      }`,
      { login: args.projectOwner, number: args.projectNumber },
    )) as { organization: { projectV2: { id: string } | null } | null };
    projectId = orgResponse.organization?.projectV2?.id;
  } catch {
    // Fall through to user lookup.
  }

  if (!projectId) {
    const userResponse = (await octokit.graphql(
      `query($login: String!, $number: Int!) {
        user(login: $login) { projectV2(number: $number) { id } }
      }`,
      { login: args.projectOwner, number: args.projectNumber },
    )) as { user: { projectV2: { id: string } | null } | null };
    projectId = userResponse.user?.projectV2?.id;
  }

  if (!projectId) {
    console.warn(
      `Project #${args.projectNumber} not found under ${args.projectOwner}; nothing to delete.`,
    );
    return;
  }

  console.log(`Deleting project ${projectId}...`);
  await octokit.graphql(
    `mutation($projectId: ID!) {
      deleteProjectV2(input: { projectId: $projectId }) { projectV2 { id } }
    }`,
    { projectId },
  );
  console.log('Deleted project.');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
