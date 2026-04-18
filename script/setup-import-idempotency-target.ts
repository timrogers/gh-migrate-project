/*
 * Setup script for the import idempotency end-to-end test.
 *
 * Simulates the situation that motivated the idempotency fix in
 * `addItemToProject` (src/commands/import.ts): a workflow such as
 * `Auto-add sub-issues to project` adds an issue to the target project
 * before the import gets to it, so the subsequent
 * `addProjectV2ItemById` mutation fails with
 * `Content already exists in this project`.
 *
 * What this script does:
 *  1. Creates an empty ProjectV2 in the given owner.
 *  2. Picks the first issue belonging to the source project that maps
 *     to a target repository according to `repository-mappings.csv`.
 *  3. Pre-adds that issue to the new target project, simulating an
 *     auto-add workflow having already run.
 *  4. Prints the new project's number to stdout and, when running in
 *     GitHub Actions, appends `project_number=<n>` to `$GITHUB_OUTPUT`
 *     so the `import` CLI can be invoked against it with
 *     `--project-number`.
 */

import { appendFileSync, readFileSync } from 'node:fs';
import { Octokit } from 'octokit';

interface Args {
  inputPath: string;
  repositoryMappingsPath: string;
  projectOwner: string;
  projectTitle: string;
}

const parseArgs = (): Args => {
  const argv = process.argv.slice(2);
  const out: Partial<Args> = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    switch (arg) {
      case '--input-path':
        out.inputPath = next;
        i += 1;
        break;
      case '--repository-mappings-path':
        out.repositoryMappingsPath = next;
        i += 1;
        break;
      case '--project-owner':
        out.projectOwner = next;
        i += 1;
        break;
      case '--project-title':
        out.projectTitle = next;
        i += 1;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (
    !out.inputPath ||
    !out.repositoryMappingsPath ||
    !out.projectOwner ||
    !out.projectTitle
  ) {
    throw new Error(
      'Required: --input-path, --repository-mappings-path, --project-owner, --project-title',
    );
  }

  return out as Args;
};

const readRepositoryMappings = (path: string): Map<string, string> => {
  const lines = readFileSync(path, 'utf8').trim().split(/\r?\n/);
  const mappings = new Map<string, string>();
  // Skip header line.
  for (const line of lines.slice(1)) {
    const [source, target] = line.split(',').map((value) => value.trim());
    if (source && target) {
      mappings.set(source, target);
    }
  }
  return mappings;
};

interface SourceItem {
  content: { __typename: string; number: number; repository: { nameWithOwner: string } };
}

const findFirstMappedIssue = (
  inputPath: string,
  repositoryMappings: Map<string, string>,
): { sourceRepository: string; targetRepository: string; number: number } => {
  const data = JSON.parse(readFileSync(inputPath, 'utf8')) as {
    projectItems: SourceItem[];
  };

  for (const item of data.projectItems) {
    if (item.content?.__typename !== 'Issue') continue;
    const sourceRepository = item.content.repository?.nameWithOwner;
    const targetRepository = repositoryMappings.get(sourceRepository);
    if (!targetRepository) continue;
    return { sourceRepository, targetRepository, number: item.content.number };
  }

  throw new Error(
    'Could not find an Issue item in the source project that has a repository mapping.',
  );
};

(async () => {
  const args = parseArgs();
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('GITHUB_TOKEN environment variable must be set.');
  }

  const octokit = new Octokit({ auth: token });

  const repositoryMappings = readRepositoryMappings(args.repositoryMappingsPath);
  const issue = findFirstMappedIssue(args.inputPath, repositoryMappings);
  console.log(
    `Will pre-add issue #${issue.number} from ${issue.targetRepository} (mapped from ${issue.sourceRepository}).`,
  );

  // Resolve owner ID. Try organization, fall back to user.
  let ownerId: string;
  try {
    const orgResponse = (await octokit.graphql(
      `query($login: String!) { organization(login: $login) { id } }`,
      { login: args.projectOwner },
    )) as { organization: { id: string } | null };
    if (!orgResponse.organization) throw new Error('not an org');
    ownerId = orgResponse.organization.id;
  } catch {
    const userResponse = (await octokit.graphql(
      `query($login: String!) { user(login: $login) { id } }`,
      { login: args.projectOwner },
    )) as { user: { id: string } };
    ownerId = userResponse.user.id;
  }

  console.log(
    `Creating empty target project "${args.projectTitle}" under ${args.projectOwner}...`,
  );
  const createResponse = (await octokit.graphql(
    `mutation($ownerId: ID!, $title: String!) {
      createProjectV2(input: { ownerId: $ownerId, title: $title }) {
        projectV2 { id number url }
      }
    }`,
    { ownerId, title: args.projectTitle },
  )) as {
    createProjectV2: { projectV2: { id: string; number: number; url: string } };
  };
  const project = createResponse.createProjectV2.projectV2;
  console.log(`Created project #${project.number} (${project.url}).`);

  console.log(`Looking up issue #${issue.number} in ${issue.targetRepository}...`);
  const [owner, name] = issue.targetRepository.split('/');
  const issueResponse = (await octokit.graphql(
    `query($owner: String!, $name: String!, $number: Int!) {
      repository(owner: $owner, name: $name) { issue(number: $number) { id } }
    }`,
    { owner, name, number: issue.number },
  )) as { repository: { issue: { id: string } | null } };

  const issueId = issueResponse.repository.issue?.id;
  if (!issueId) {
    throw new Error(`Issue #${issue.number} not found in ${issue.targetRepository}.`);
  }

  console.log(
    `Pre-adding issue ${issueId} to project ${project.id} (simulating auto-add workflow)...`,
  );
  await octokit.graphql(
    `mutation($projectId: ID!, $contentId: ID!) {
      addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
        item { id }
      }
    }`,
    { projectId: project.id, contentId: issueId },
  );
  console.log('Pre-added the issue. The import should now hit the duplicate path.');

  console.log(`project_number=${project.number}`);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `project_number=${project.number}\n`);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
