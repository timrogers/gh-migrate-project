# Contributing

## Unit tests

This project includes unit tests for core utilities and logic. The tests are written using Node.js built-in test runner and are located in the `tests/` directory.

### Running unit tests

To run all unit tests:

```bash
npm test
```

To run tests for a specific file:

```bash
npx tsx --test tests/utils.test.js
```

### Writing tests

Unit tests are written using Node.js built-in test runner with the following structure:

- Tests are located in the `tests/` directory
- Test files should end with `.test.js`
- Import from source files using `.ts` extension (e.g., `import { func } from '../src/utils.ts'`)
- Use `describe()` for grouping tests and `test()` for individual test cases
- Use Node.js built-in `assert` module for assertions

Example:

```javascript
import { test, describe } from 'node:test';
import assert from 'node:assert';
import { myFunction } from '../src/my-module.ts';

describe('myFunction', () => {
  test('should return expected value', () => {
    const result = myFunction('input');
    assert.strictEqual(result, 'expected');
  });
});
```

## End-to-end testing

This tool supports exports from and imports to GitHub Enterprise Server (GHES).

Every time code is pushed, end-to-end tests run in GitHub Actions against GitHub.com and supported versions of GitHub Enterprise Server.

From time to time, we need to update the access token used for end-to-end tests against GitHub.com.

We also regularly need to add or remove supported GitHub Enterprise Server versions, or re-provision existing GitHub Enterprise Server versions with a new instance and/or new access token. For details, see the "GitHub Enterprise Server support" section below.

### Updating the access token used for GitHub.com

Our end-to-end tests require a GitHub.com access token with relevant permissions to access the `gh-migrate-project-sandbox` organization.

To refresh the token:

1. Ensure you have admin access to the `gh-migrate-project-sandbox` organization on GitHub.com.
2. Navigate to GitHub's ["New fine-grained personal access token" UI](https://github.com/settings/personal-access-tokens/new).
3. Give the token a unique name, and set as long as an expiration as you can.
4. Set the resource owner for the token to `gh-migrate-project-sandbox`, so the token can access its resources.
5. Set "Repository access" to "All repositories".
6. In "Repository permissions", add the following permissions:

- Contents: Read and write
- Issues: Read-only
- Metadata: Read-only
- Pull requests: Read-only

7. In "Organization permissions", add the following permissions:

- Projects: Read and write

8. Create your token, and copy the value to the clipboard.
9. Navigate to the repository's [Actions secrets](https://github.com/timrogers/gh-migrate-project/settings/secrets/actions) and update `GH_MIGRATE_PROJECT_SANDBOX_TOKEN` to the new value.
10. Navigate to the repository's [Dependabot secrets](https://github.com/timrogers/gh-migrate-project/settings/secrets/dependabot) and update `GH_MIGRATE_PROJECT_SANDBOX_TOKEN` to the new value.

### Cleaning up projects on GitHub.com

Running end-to-end tests creates projects on GitHub.com, and there is a maximum limit on how many projects can exist at one time attached to an organization.

When you hit this limit, projects have to be cleaned up, or end-to-end tests will start to fail.

To clean up old projects, set `GITHUB_TOKEN` to a token with access to the `gh-migrate-project-sandbox` organization on GitHub.com (see "Updating the access token used for GitHub.com" above for instructions on creating such a token), and then run `npm run clean-up-organization-projects`.

## GitHub Enterprise Server support

This tool supports exports from and imports to GitHub Enterprise Server (GHES).

We only commit to supporting [GitHub Enterprise Server releases supported by GitHub](https://docs.github.com/en/enterprise-server/admin/all-releases). Releases are deprecated roughly a year after release, and once a release is deprecated, we will drop support in this tool.

From time to time, we need to add or remove supported GitHub Enterprise Server versions. We may also need to re-provision existing GitHub Enterprise Server versions with a new instance and/or new access token.

### Adding support for a new GitHub Enterprise Server (GHES) version, including automated tests

1. Deploy a GitHub Enterprise Server (GHES) instance of the required version
1. Create a personal access token (PAT) with the `repo`, `admin:org`, `site_admin` and `project` scopes
1. Seed the GHES instance with data and configure the Actions and Dependabot secrets. You can do this by running `npm run configure-github-enterprise-server-instance -- --ghes-access-token TOKEN --ghes-base-url https://ghes.acme.com/api/v3 --dotcom-access-token FOO`.
1. Open `.github/workflows/ci.yml` and make a copy of an existing job used to test a GHES version (e.g. `end_to_end_tests_linux_ghes_311`)
1. Rename the job to an appropriate name for the new version, e.g. `end_to_end_tests_linux_ghes_312`
1. Update the GHES version in the job's `name`
1. In the "Import project to GHES" step, update the two secrets references to refer to your new secrets
1. In the "Upload outputs as artifacts", update the name with the new GHES version (e.g. `linux-outputs-ghes-312`)
1. Update the `needs` configuration for the `check_release_tag_matches_version` job to include the name of your new job

### Removing support for a GitHub Enterprise Server (GHES) version

1. Update the `MINIMUM_SUPPORTED_GITHUB_ENTERPRISE_SERVER_VERSION_FOR_EXPORTS` and `MINIMUM_SUPPORTED_GITHUB_ENTERPRISE_SERVER_VERSION_FOR_IMPORTS` variables in `src/github-products.ts` as appropriate to drop support for the version.
1. Open `.github/workflows/ci.yml` and remove the job used to test the GHES version (e.g. `end_to_end_tests_linux_ghes_311`)
1. Update the `needs` configuration for the `check_release_tag_matches_version` job to remove the job you just removed
1. Remove the `GHES_XXX_ACCESS_TOKEN` and `GHES_XXX_BASE_URL` [Actions secrets](https://github.com/timrogers/gh-migrate-project/settings/secrets/actions) and [Dependabot secrets](https://github.com/timrogers/gh-migrate-project/settings/secrets/dependabot) for the version (e.g. `GHES_312_BASE_URL` for GitHub Enterprise Server 3.12)

### Updating the access token used for a GitHub Enterprise Server version

Our end-to-end tests cover exports from and imports to a number of GitHub Enterprise Server versions.

From time to time, you may need to update this token due to expiry or having reprovisioned the GitHub Enterprise Server instance.

To refresh the token and ensure an instance is ready:

1. Create a new personal access token (PAT) with the `repo`, `admin:org`, `project` and `site_admin` scopes
1. Update the Actions and Dependabot secrets by running `npm run configure-github-enterprise-server-instance -- --ghes-access-token TOKEN --ghes-base-url https://ghes.acme.com/api/v3 --dotcom-access-token FOO`.
