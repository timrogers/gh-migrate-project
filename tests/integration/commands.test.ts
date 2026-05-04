/**
 * Integration tests for gh-migrate-project.
 *
 * These tests run the actual CLI commands (export/import) against a mock HTTP server
 * that replays recorded fixtures from the real GitHub API, so no network access
 * or tokens are required.
 *
 * The mock server runs in the Jest process and we spawn the CLI as an async child
 * process (since spawnSync blocks the event loop, preventing the in-process server
 * from responding).
 */

import { spawn } from 'child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { MockGitHubServer } from './mock-server.js';

const ROOT_DIR = join(__dirname, '..', '..');
const TSX_BIN = join(ROOT_DIR, 'node_modules', '.bin', 'tsx');
const CLI_ENTRY = join(ROOT_DIR, 'src', 'index.ts');

/**
 * Run the CLI as an async subprocess. Returns a promise that resolves with
 * { stdout, stderr, exitCode }.
 */
function runCli(
  args: string[],
  env: Record<string, string> = {},
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const child = spawn(TSX_BIN, [CLI_ENTRY, ...args], {
      env: {
        ...process.env,
        ...env,
        NODE_NO_WARNINGS: '1',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });
    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({ stdout, stderr, exitCode: code ?? 1 });
    });

    // Close stdin immediately to avoid interactive prompts blocking
    child.stdin.end();
  });
}

let server: MockGitHubServer;
let baseUrl: string;
let testDir: string;

beforeAll(async () => {
  server = new MockGitHubServer();
  await server.start();
  baseUrl = server.getBaseUrl();
});

afterAll(async () => {
  await server.stop();
});

beforeEach(() => {
  testDir = join(
    ROOT_DIR,
    '.test-output',
    `test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(testDir, { recursive: true });
  server.resetLog();
});

afterEach(() => {
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true });
  }
});

describe('export command', () => {
  function exportArgs(
    overrides: Partial<{
      projectOutput: string;
      repoMappings: string;
      assigneeMappings: string;
    }> = {},
  ) {
    return [
      'export',
      '--base-url',
      baseUrl,
      '--project-owner',
      'gh-migrate-project-sandbox',
      '--project-number',
      '1026',
      '--project-output-path',
      overrides.projectOutput || join(testDir, 'project.json'),
      '--repository-mappings-output-path',
      overrides.repoMappings || join(testDir, 'repository-mappings.csv'),
      '--assignee-mappings-output-path',
      overrides.assigneeMappings || join(testDir, 'assignee-mappings.csv'),
      '--disable-telemetry',
      '--skip-update-check',
    ];
  }

  it('produces project.json with correct project structure', async () => {
    const projectOutput = join(testDir, 'project.json');
    const result = await runCli(exportArgs({ projectOutput }), {
      EXPORT_GITHUB_TOKEN: 'fake-token',
    });

    expect(result.exitCode).toBe(0);
    expect(existsSync(projectOutput)).toBe(true);

    const data = JSON.parse(readFileSync(projectOutput, 'utf-8'));
    expect(data).toHaveProperty('project');
    expect(data).toHaveProperty('projectItems');
    expect(data.project.title).toBe('Source project to be migrated');
    expect(data.project).toHaveProperty('fields');
    expect(data.project).toHaveProperty('views');
    expect(data.project).toHaveProperty('repositories');
  });

  it('exports all project items', async () => {
    const projectOutput = join(testDir, 'project.json');
    const result = await runCli(exportArgs({ projectOutput }), {
      EXPORT_GITHUB_TOKEN: 'fake-token',
    });

    expect(result.exitCode).toBe(0);
    const data = JSON.parse(readFileSync(projectOutput, 'utf-8'));
    expect(data.projectItems).toHaveLength(3);
  });

  it('exports items with correct content types (Issue, DraftIssue)', async () => {
    const projectOutput = join(testDir, 'project.json');
    await runCli(exportArgs({ projectOutput }), { EXPORT_GITHUB_TOKEN: 'fake-token' });

    const data = JSON.parse(readFileSync(projectOutput, 'utf-8'));
    const types = data.projectItems.map(
      (item: { content: { __typename: string } }) => item.content.__typename,
    );
    expect(types).toContain('Issue');
    expect(types).toContain('DraftIssue');
  });

  it('exports project fields with correct data types', async () => {
    const projectOutput = join(testDir, 'project.json');
    await runCli(exportArgs({ projectOutput }), { EXPORT_GITHUB_TOKEN: 'fake-token' });

    const data = JSON.parse(readFileSync(projectOutput, 'utf-8'));
    const fieldNames = data.project.fields.nodes.map((f: { name: string }) => f.name);

    expect(fieldNames).toContain('Title');
    expect(fieldNames).toContain('Status');
    expect(fieldNames).toContain('Priority');
    expect(fieldNames).toContain('Estimate');
    expect(fieldNames).toContain('Iteration');
  });

  it('exports single-select fields with options', async () => {
    const projectOutput = join(testDir, 'project.json');
    await runCli(exportArgs({ projectOutput }), { EXPORT_GITHUB_TOKEN: 'fake-token' });

    const data = JSON.parse(readFileSync(projectOutput, 'utf-8'));
    const statusField = data.project.fields.nodes.find(
      (f: { name: string }) => f.name === 'Status',
    );
    expect(statusField).toBeDefined();
    expect(statusField.options).toHaveLength(3);
    expect(statusField.options.map((o: { name: string }) => o.name)).toEqual([
      'Todo',
      'In Progress',
      'Done',
    ]);
  });

  it('exports project views with layout info', async () => {
    const projectOutput = join(testDir, 'project.json');
    await runCli(exportArgs({ projectOutput }), { EXPORT_GITHUB_TOKEN: 'fake-token' });

    const data = JSON.parse(readFileSync(projectOutput, 'utf-8'));
    const views = data.project.views.nodes;
    expect(views.length).toBeGreaterThan(0);

    for (const view of views) {
      expect(view).toHaveProperty('name');
      expect(view).toHaveProperty('layout');
      expect(view).toHaveProperty('number');
      expect(view).toHaveProperty('visibleFields');
    }
  });

  it('generates repository mappings CSV with source repos from items', async () => {
    const repoMappings = join(testDir, 'repository-mappings.csv');
    await runCli(exportArgs({ repoMappings }), { EXPORT_GITHUB_TOKEN: 'fake-token' });

    expect(existsSync(repoMappings)).toBe(true);
    const content = readFileSync(repoMappings, 'utf-8');
    expect(content.startsWith('source_repository,target_repository')).toBe(true);
    expect(content).toContain('gh-migrate-project-sandbox/initial-repository');
  });

  it('generates assignee mappings CSV with draft issue assignees', async () => {
    const assigneeMappings = join(testDir, 'assignee-mappings.csv');
    await runCli(exportArgs({ assigneeMappings }), { EXPORT_GITHUB_TOKEN: 'fake-token' });

    expect(existsSync(assigneeMappings)).toBe(true);
    const content = readFileSync(assigneeMappings, 'utf-8');
    expect(content.startsWith('source_login,target_login')).toBe(true);
    expect(content).toContain('timrogers');
  });

  it('exports issue items with repository info and number', async () => {
    const projectOutput = join(testDir, 'project.json');
    await runCli(exportArgs({ projectOutput }), { EXPORT_GITHUB_TOKEN: 'fake-token' });

    const data = JSON.parse(readFileSync(projectOutput, 'utf-8'));
    const issueItem = data.projectItems.find(
      (i: { content: { __typename: string } }) => i.content.__typename === 'Issue',
    );
    expect(issueItem.content.repository.nameWithOwner).toBe(
      'gh-migrate-project-sandbox/initial-repository',
    );
    expect(issueItem.content.number).toBe(1);
    expect(issueItem.content.title).toBe('A crucial issue');
  });

  it('exports draft issues with creator and assignee info', async () => {
    const projectOutput = join(testDir, 'project.json');
    await runCli(exportArgs({ projectOutput }), { EXPORT_GITHUB_TOKEN: 'fake-token' });

    const data = JSON.parse(readFileSync(projectOutput, 'utf-8'));
    const draftItem = data.projectItems.find(
      (i: { content: { __typename: string; title: string } }) =>
        i.content.__typename === 'DraftIssue' &&
        i.content.title === 'Draft issue with assignee',
    );
    expect(draftItem).toBeDefined();
    expect(draftItem.content.creator.login).toBe('timrogers');
    expect(draftItem.content.assignees.nodes[0].login).toBe('timrogers');
  });

  it('exports items with field values', async () => {
    const projectOutput = join(testDir, 'project.json');
    await runCli(exportArgs({ projectOutput }), { EXPORT_GITHUB_TOKEN: 'fake-token' });

    const data = JSON.parse(readFileSync(projectOutput, 'utf-8'));
    for (const item of data.projectItems) {
      expect(item.fieldValues.nodes.length).toBeGreaterThan(0);
    }
  });

  it('fails when output path already exists', async () => {
    const projectOutput = join(testDir, 'project.json');
    writeFileSync(projectOutput, '{}');

    const result = await runCli(exportArgs({ projectOutput }), {
      EXPORT_GITHUB_TOKEN: 'fake-token',
    });
    expect(result.exitCode).not.toBe(0);
  });

  it('fails without an access token', async () => {
    const result = await runCli(exportArgs(), { EXPORT_GITHUB_TOKEN: '' });
    expect(result.exitCode).not.toBe(0);
  });

  it('makes expected GraphQL API calls', async () => {
    await runCli(exportArgs(), { EXPORT_GITHUB_TOKEN: 'fake-token' });

    const queries = server.getGraphqlQueries();
    const queryTexts = queries.map((q) => q.query);

    expect(queryTexts.some((q) => q.includes('rateLimit'))).toBe(true);
    expect(queryTexts.some((q) => q.includes('projectV2') && q.includes('$number'))).toBe(
      true,
    );
    expect(queryTexts.some((q) => q.includes('fields') && q.includes('views'))).toBe(
      true,
    );
    expect(queryTexts.some((q) => q.includes('items') && q.includes('pageInfo'))).toBe(
      true,
    );
  });
});

describe('import command', () => {
  let projectJsonPath: string;
  let repoMappingsPath: string;
  let assigneeMappingsPath: string;

  beforeEach(async () => {
    projectJsonPath = join(testDir, 'project.json');
    const repoMappingsExportPath = join(testDir, 'export-repo.csv');
    const assigneeMappingsExportPath = join(testDir, 'export-assignee.csv');

    // Export first to generate project.json
    await runCli(
      [
        'export',
        '--base-url',
        baseUrl,
        '--project-owner',
        'gh-migrate-project-sandbox',
        '--project-number',
        '1026',
        '--project-output-path',
        projectJsonPath,
        '--repository-mappings-output-path',
        repoMappingsExportPath,
        '--assignee-mappings-output-path',
        assigneeMappingsExportPath,
        '--disable-telemetry',
        '--skip-update-check',
      ],
      { EXPORT_GITHUB_TOKEN: 'fake-token' },
    );

    // Prepare completed mapping files
    repoMappingsPath = join(testDir, 'completed-repo-mappings.csv');
    writeFileSync(
      repoMappingsPath,
      'source_repository,target_repository\ngh-migrate-project-sandbox/initial-repository,gh-migrate-project-sandbox/initial-repository\n',
    );

    assigneeMappingsPath = join(testDir, 'completed-assignee-mappings.csv');
    writeFileSync(
      assigneeMappingsPath,
      'source_login,target_login\ntimrogers,ghe-admin\n',
    );

    server.resetLog();
  });

  function importArgs(extra: string[] = []) {
    return [
      'import',
      '--base-url',
      baseUrl,
      '--input-path',
      projectJsonPath,
      '--repository-mappings-path',
      repoMappingsPath,
      '--assignee-mappings-path',
      assigneeMappingsPath,
      '--project-owner',
      'gh-migrate-project-sandbox',
      '--disable-telemetry',
      '--skip-update-check',
      ...extra,
    ];
  }

  it('completes an import successfully', async () => {
    const result = await runCli(importArgs(), { IMPORT_GITHUB_TOKEN: 'fake-token' });
    expect(result.exitCode).toBe(0);
  });

  it('creates a new project via GraphQL', async () => {
    await runCli(importArgs(), { IMPORT_GITHUB_TOKEN: 'fake-token' });

    const queries = server.getGraphqlQueries();
    const createProjectQuery = queries.find((q) => q.query.includes('createProjectV2'));
    expect(createProjectQuery).toBeDefined();
  });

  it('looks up the organization global ID', async () => {
    await runCli(importArgs(), { IMPORT_GITHUB_TOKEN: 'fake-token' });

    const queries = server.getGraphqlQueries();
    const orgIdQuery = queries.find(
      (q) =>
        q.query.includes('organization') &&
        q.query.includes('id') &&
        !q.query.includes('projectV2'),
    );
    expect(orgIdQuery).toBeDefined();
  });

  it('creates project items for each source item', async () => {
    await runCli(importArgs(), { IMPORT_GITHUB_TOKEN: 'fake-token' });

    const queries = server.getGraphqlQueries();
    const addItemQueries = queries.filter(
      (q) =>
        q.query.includes('addProjectV2ItemById') ||
        q.query.includes('addProjectV2DraftIssue'),
    );
    // 1 issue + 2 draft issues = 3 items
    expect(addItemQueries.length).toBe(3);
  });

  it('creates custom fields on the target project', async () => {
    await runCli(importArgs(), { IMPORT_GITHUB_TOKEN: 'fake-token' });

    const queries = server.getGraphqlQueries();
    const createFieldQueries = queries.filter((q) =>
      q.query.includes('createProjectV2Field'),
    );
    expect(createFieldQueries.length).toBeGreaterThan(0);
  });

  it('sets field values on imported items', async () => {
    await runCli(importArgs(), { IMPORT_GITHUB_TOKEN: 'fake-token' });

    const queries = server.getGraphqlQueries();
    const updateFieldQueries = queries.filter((q) =>
      q.query.includes('updateProjectV2ItemFieldValue'),
    );
    expect(updateFieldQueries.length).toBeGreaterThan(0);
  });

  it('resolves assignee mappings via user lookup', async () => {
    await runCli(importArgs(), { IMPORT_GITHUB_TOKEN: 'fake-token' });

    const queries = server.getGraphqlQueries();
    const userLookup = queries.find(
      (q) => q.query.includes('user') && q.variables?.login === 'ghe-admin',
    );
    expect(userLookup).toBeDefined();
  });

  it('configures the Status field on the target project', async () => {
    await runCli(importArgs(), { IMPORT_GITHUB_TOKEN: 'fake-token' });

    const queries = server.getGraphqlQueries();
    const statusQuery = queries.find((q) => q.query.includes('updateProjectV2Field'));
    expect(statusQuery).toBeDefined();
  });

  it('uses a custom project title when specified', async () => {
    await runCli(importArgs(['--project-title', 'Custom Title']), {
      IMPORT_GITHUB_TOKEN: 'fake-token',
    });

    const queries = server.getGraphqlQueries();
    const createProjectQuery = queries.find((q) => q.query.includes('createProjectV2'));
    expect(createProjectQuery?.variables?.title).toBe('Custom Title');
  });

  it('fails without an access token', async () => {
    const result = await runCli(importArgs(), { IMPORT_GITHUB_TOKEN: '' });
    expect(result.exitCode).not.toBe(0);
  });

  it('fails when input path does not exist', async () => {
    rmSync(projectJsonPath);
    const result = await runCli(importArgs(), { IMPORT_GITHUB_TOKEN: 'fake-token' });
    expect(result.exitCode).not.toBe(0);
  });

  it('fails when repository mappings path does not exist', async () => {
    rmSync(repoMappingsPath);
    const result = await runCli(importArgs(), { IMPORT_GITHUB_TOKEN: 'fake-token' });
    expect(result.exitCode).not.toBe(0);
  });
});

describe('error handling', () => {
  it('export fails when --project-number is missing', async () => {
    const result = await runCli(
      [
        'export',
        '--base-url',
        baseUrl,
        '--project-owner',
        'gh-migrate-project-sandbox',
        '--disable-telemetry',
        '--skip-update-check',
      ],
      { EXPORT_GITHUB_TOKEN: 'fake-token' },
    );
    expect(result.exitCode).not.toBe(0);
  });

  it('export fails when --project-owner is missing', async () => {
    const result = await runCli(
      [
        'export',
        '--base-url',
        baseUrl,
        '--project-number',
        '1026',
        '--disable-telemetry',
        '--skip-update-check',
      ],
      { EXPORT_GITHUB_TOKEN: 'fake-token' },
    );
    expect(result.exitCode).not.toBe(0);
  });

  it('import fails when --project-owner is missing', async () => {
    const projectOutput = join(testDir, 'project.json');
    writeFileSync(
      projectOutput,
      JSON.stringify({
        project: {
          fields: { nodes: [] },
          repositories: { nodes: [] },
          views: { nodes: [] },
        },
        projectItems: [],
      }),
    );
    const repoMappings = join(testDir, 'repo.csv');
    writeFileSync(repoMappings, 'source_repository,target_repository\n');
    const assigneeMappings = join(testDir, 'assignee.csv');
    writeFileSync(assigneeMappings, 'source_login,target_login\n');

    const result = await runCli(
      [
        'import',
        '--base-url',
        baseUrl,
        '--input-path',
        projectOutput,
        '--repository-mappings-path',
        repoMappings,
        '--assignee-mappings-path',
        assigneeMappings,
        '--disable-telemetry',
        '--skip-update-check',
      ],
      { IMPORT_GITHUB_TOKEN: 'fake-token' },
    );
    expect(result.exitCode).not.toBe(0);
  });
});
