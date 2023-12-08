# `gh migrate-project`

A [GitHub CLI](https://cli.github.com/) [extension](https://cli.github.com/manual/gh_extension) for migrating [GitHub Projects](https://docs.github.com/en/issues/planning-and-tracking-with-projects) between:

- GitHub Enterprise Server v3.7+ and GitHub.com
- owners (organizations or users) on GitHub.com (e.g. from a classic GitHub.com organization to [Enterprise Managed Users](https://docs.github.com/en/enterprise-cloud@latest/admin/identity-and-access-management/using-enterprise-managed-users-for-iam/about-enterprise-managed-users) organization)

## Limitations

### Classic projects are not supported

This tool can't migrate so-called classic Projects - only the newer version of [GitHub Projects](https://docs.github.com/en/issues/planning-and-tracking-with-projects).

Classic Projects can be migrated with [GitHub Enterprise Importer](https://docs.github.com/en/migrations/using-github-enterprise-importer) or [`ghe-migrator`](https://docs.github.com/en/enterprise-cloud@latest/migrations/using-ghe-migrator/about-ghe-migrator).

### Exports are supported from GitHub Enterprise Server, but only 3.7 onwards

[GitHub Projects](https://docs.github.com/en/issues/planning-and-tracking-with-projects) is only available in GitHub Enterprise Server 3.7 onwards, so this tool will only work with 3.7 onwards for exports.

### Once data has been exported, it can only be imported to GitHub.com

At this time, imports to GitHub Enterprise Server are not supported, so you won't be able to use this tool to move between Enterprise Server instances or from GitHub.com to your own Enterprise Server.

This will be fixable with some work, but it's complicated because of GraphQL API differences between GitHub.com and current Enterprise Server versions.

### Not all data is migrated

The following data is not migrated and will be skipped:

- Views
- The order of project items displayed in your views
- Workflows
- Iteration custom fields
- Draft issues' assignees

### Draft issues will show the person running the migration as the author

Migrated draft issues will show as being created by the person who ran the migration at the time they ran the migration. A note will be prepended to the body with original author login and timestamp.

## Instructions

### Step 1. Install the GitHub CLI extension

Make sure you've got the [GitHub CLI](https://cli.github.com/) installed. If you haven't, you can install it by following the instructions [here](https://github.com/cli/cli#installation).

Once `gh` is ready and available on your machine, you can install this extension by running `gh extension install timrogers/gh-migrate-project`.

You can check that the extension is installed and working by running `gh migrate-project --help`.

### Step 2. Migrate your issues and pull requests

Items in GitHub Projects are linked to issues and pull requests. Before you can migrate a project, you need to make sure that the relevant issues and pull requests are already migrated.

If you're migrating from GitHub Enterprise Server to GitHub.com or between organizations on GitHub.com, you can migrate your issues and pull requests using [GitHub Enterprise Importer](https://docs.github.com/en/migrations/using-github-enterprise-importer).

If you're migrating to GitHub Enterprise Server, you can migrate your issues and pull requests using [`ghe-migrator`](https://docs.github.com/en/enterprise-cloud@latest/migrations/using-ghe-migrator/about-ghe-migrator).

When you run your migrations, make a note of the new owner and repo name for each repository.

### Step 3: Export your project from migration source

Migrating a project is split into two distinct phases: export and import. The first step is to export your project and its items from your migration source.

To export a project, you'll need a token with appropriate permissions. The extension won't use your existing login session for the GitHub CLI. You'll need a classic token with the `read:project` and `repo` scopes, [authorized for SSO](https://docs.github.com/en/enterprise-cloud@latest/authentication/authenticating-with-saml-single-sign-on/authorizing-a-personal-access-token-for-use-with-saml-single-sign-on) if applicable.

You can export your project and its items using the `gh migrate-project export` command:

```bash
gh migrate-project export \
    # A GitHub access token with the permissions described above. This can also be configured using the `EXPORT_GITHUB_TOKEN` environment variable.
    --access-token GITHUB_TOKEN \
    # The organization or user who owns the project you want to export
    --project-owner monalisa \
    # The type of the owner of the project you want to export (defaults to organization; only required if the owner is a user)
    --project-owner-type user \
    # The number of the project you want to export
    --project-number 1337 \
    # OPTIONAL: The base URL of the GitHub API, if you're migrating from a migration source other than GitHub.com.
    --base-url https://github.acme.inc/api/v3 \
    # OPTIONAL: The URL of an HTTP(S) proxy to use for requests to the GitHub API (e.g. `http://localhost:3128`). This can also be set using the EXPORT_PROXY_URL environment variable.
    --proxy-url https://10.0.0.1:3128 \
    # OPTIONAL: Emit detailed, verbose logs (off by default)
    --verbose \
    # OPTIONAL: Disable anonymous telemetry that gives the maintainers of this tool basic information about real-world usage.
    --disable-telemetry
```

When the export finishes, you'll have two files written to your current directory:

- `project.json`: The raw data of your project and all of its project items
- `repository-mappings.csv`: A repository mappings CSV template that you need to fill out with the names of your repositories in the migration target

### Step 4. Complete the repository mappings template

You'll need to complete the `repository-mappings.csv` file outputted from the `export` command with repository mappings, so the tool knows how to match repositories in your migration source to repositories in your migration target.

The CSV will look like this:

```
source_repository,target_repository
corp/widgets,
corp/website,
```

Imagine that you're in the process of migrating from GitHub Enterprise Server to GitHub.com, and you've already moved your repositories into a new GitHub.com organization called `monalisa-emu`. You'd fill out the CSV like this:

```
source_repository,target_repository
corp/widgets,monalisa-emu/widgets
corp/website,monalisa-emu/website
```

If you don't want to map a repository - for example because it hasn't been migrated - just delete the line from the CSV or leave the `target_repository` blank. If a repository hasn't been mapped, project items related to that repository will be skipped during the import.

### Step 5. Import your project into your migration target

You've exported your data and filled out the repository mappings template. You can now import your project into your migration target.

To export a project, you'll need a token with appropriate permissions. The extension won't use your existing login session for the GitHub CLI. You'll need a classic token with the `read:project` and `repo` scopes, [authorized for SSO](https://docs.github.com/en/enterprise-cloud@latest/authentication/authenticating-with-saml-single-sign-on/authorizing-a-personal-access-token-for-use-with-saml-single-sign-on) if applicable. If you're creating an organization project, you'll also need the `read:org` scope.

You can import your project using the `gh migrate-project import` command:

```bash
gh migrate-project import \
    # A GitHub access token with the permissions described above. This can also be configured using the `IMPORT_GITHUB_TOKEN` environment variable.
    --access-token GITHUB_TOKEN \
    # The name of the organization or user that will own the newly-imported project
    --project-owner monalisa \
    # The type of the owner who will own the project (defaults to organization; only required if the owner is a user)
    --project-owner-type user \
    # The path of the project data generated by the `export` command
    --input-path project.json \
    # The path of the repository mappings file generated by the `export` command and completed by you
    --repository-mappings-path repository-mappings.csv \
    # OPTIONAL: The base URL of the GitHub API, if you're migrating to a migration target other than GitHub.com.
    --base-url https://github.acme.inc/api/v3 \
    # OPTIONAL: The URL of an HTTP(S) proxy to use for requests to the GitHub API (e.g. `http://localhost:3128`). This can also be set using the IMPORT_PROXY_URL environment variable.
    --proxy-url https://10.0.0.1:3128 \
    # OPTIONAL: The title to use for the imported project. Defaults to the title of the source project.
    --project-title "My Imported Project" \
    # OPTIONAL: Emit detailed, verbose logs (off by default)
    --verbose \
    # OPTIONAL: Disable anonymous telemetry that gives the maintainers of this tool basic information about real-world usage.
    --disable-telemetry
```

Near the start of the import, the tool will ask you to manually set up your options for the "Status" field. It will explain exactly what to do, and will validate that you've correctly copied the options from your migration source.

Once you've set up the "Status" field, your project will be imported. Watch out for `warn` lines in the logs, which will let you know about data which hasn't been imported.

### Troubleshooting

If you run into SSL connection errors and you are unable to set your proxy settings with the `--proxy-url` parameter, you can set the `NODE_TLS_REJECT_UNAUTHORIZED=0` environment variable to bypass:

```
export NODE_TLS_REJECT_UNAUTHORIZED=0 # setting an environment variable in bash
$Env:NODE_TLS_REJECT_UNAUTHORIZED = 0 # setting an environment variable in PowerShell
```

## Telemetry

This extension includes basic, anonymous telemetry to give the maintainers information about real-world usage. This data is limited to:

- The number of exports and imports being run
- The versions of GitHub Enterprise Server being used
- The versions of the extension currently in used

You can disable all telemetry by specifying the `--disable-telemetry` argument.