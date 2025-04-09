# `gh migrate-project`

A [GitHub CLI](https://cli.github.com/) [extension](https://cli.github.com/manual/gh_extension) for migrating [GitHub Projects](https://docs.github.com/en/issues/planning-and-tracking-with-projects) between GitHub accounts and products

## Supported migration paths

- From GitHub Enterprise Server v3.12+ to:
  - GitHub.com
  - [GitHub Enterprise Cloud with data residency](https://github.com/newsroom/press-releases/data-residency-in-the-eu)
  - GitHub Enterprise Server v3.12+
- From GitHub.com to:
  - Another organization or user account on GitHub.com (e.g. from a classic GitHub.com organization to [Enterprise Managed Users](https://docs.github.com/en/enterprise-cloud@latest/admin/identity-and-access-management/using-enterprise-managed-users-for-iam/about-enterprise-managed-users) organization)
  - [GitHub Enterprise Cloud with data residency](https://github.com/newsroom/press-releases/data-residency-in-the-eu)
  - GitHub Enterprise Server v3.12+
- From [GitHub Enterprise Cloud with data residency](https://github.com/newsroom/press-releases/data-residency-in-the-eu) to:
  - GitHub.com
  - Another [GitHub Enterprise Cloud with data residency](https://github.com/newsroom/press-releases/data-residency-in-the-eu) organization or tenant
  - GitHub Enterprise Server v3.12+

Using an earlier GitHub Enterprise Server release? See "Supported GitHub Enterprise Server versions" below to find a version of `gh-migrate-project` which will work for you.

## Instructions

### Step 1. Install the GitHub CLI extension

Make sure you've got the [GitHub CLI](https://cli.github.com/) installed. If you haven't, you can install it by following the instructions [here](https://github.com/cli/cli#installation).

Once `gh` is ready and available on your machine, you can install this extension by running `gh extension install timrogers/gh-migrate-project`.

You can check that the extension is installed and working by running `gh migrate-project --help`.

### Step 2. Migrate your issues and pull requests

Items in GitHub Projects are linked to issues and pull requests. Before you can migrate a project, you need to make sure that the relevant issues and pull requests are already migrated.

For all migrations except migrations to GitHub Enterprise Server, you can migrate your issues and pull requests using [GitHub Enterprise Importer](https://docs.github.com/en/migrations/using-github-enterprise-importer).

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
    # OPTIONAL: The base URL for the GitHub API if you are exporting from a source other than GitHub.com. For GitHub Enterprise Server, this will be something like `https://github.acme.inc/api/v3`. For GitHub Enterprise Cloud with data residency, this will be `https://api.acme.ghe.com`, replacing `acme` with your own tenant.
    --base-url https://github.acme.inc/api/v3 \
    # OPTIONAL: The URL of an HTTP(S) proxy to use for requests to the GitHub API (e.g. `http://localhost:3128`). This can also be set using the EXPORT_PROXY_URL environment variable.
    --proxy-url https://10.0.0.1:3128 \
    # OPTIONAL: Emit detailed, verbose logs (off by default)
    --verbose \
    # OPTIONAL: Disable anonymous telemetry that gives the maintainers of this tool basic information about real-world usage.
    --disable-telemetry \
    # OPTIONAL: Skip verification of SSL certificates when connecting to GitHub. You may need to use this option if connecting to a GitHub Enterprise Server instance with a self-signed certificate, or if you have configured a proxy.
    --skip-certificate-verification \
    # OPTIONAL: Skip automatic check for updates to this tool
    --skip-update-check
```

When the export finishes, you'll have up to three files written to your current directory:

- `project.json`: The raw data of your project and all of its project items
- `repository-mappings.csv`: A repository mappings CSV template that you need to fill out with the names of your repositories in the migration target
- `assignee-mapping.csv` (optional): An assignee mappings CSV template that you may fill out with usernames in the migration target. This will only be generated if the project contains one or more draft issue project items with one or more assignees.

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

### Step 5. Complete the assignees mappings template

If an `assignee-mappings.csv` file is generated, you may want to complete it with username mappings so that the assignees of draft issue project items can be correctly reflected in your migration target.

The CSV will look like this:

```
source_login,target_login
monalisa,
timrogers,
```

Imagine that you're in the process of migrating from GitHub Enterprise Server to GitHub.com. You would map the users' usernames on your server to the users' usernames on GitHub.com, like this:

```
source_login,source_repository
monalisa,monathecat
timrogers,timrogers0104
```

If you don't want to map a user, just delete the line from the CSV or leave the `target_login` blank. Where that user is assigned to a draft issue in the migration source, the assignment will be lost in the migration target.

### Step 6. Import your project into your migration target

You've exported your data and filled out the repository mappings template. You can now import your project into your migration target.

To import a project, you'll need a token with appropriate permissions. The extension won't use your existing login session for the GitHub CLI. You'll need a classic token with the `project` and `repo` scopes, [authorized for SSO](https://docs.github.com/en/enterprise-cloud@latest/authentication/authenticating-with-saml-single-sign-on/authorizing-a-personal-access-token-for-use-with-saml-single-sign-on) if applicable. If you're creating an organization project, you'll also need the `write:org` scope.

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
    # The path of the assignee mappings file generated by the `export` command and completed by you
    --assignee-mappings-path assignee-mappings.csv \
    # OPTIONAL: The base URL for the GitHub API if you are importing to a target other than GitHub.com. For GitHub Enterprise Server, this will be something like `https://github.acme.inc/api/v3`. For GitHub Enterprise Cloud with data residency, this will be `https://api.acme.ghe.com`, replacing `acme` with your own tenant.
    --base-url https://github.acme.inc/api/v3 \
    # OPTIONAL: The URL of an HTTP(S) proxy to use for requests to the GitHub API (e.g. `http://localhost:3128`). This can also be set using the IMPORT_PROXY_URL environment variable.
    --proxy-url https://10.0.0.1:3128 \
    # OPTIONAL: The title to use for the imported project. Defaults to the title of the source project.
    --project-title "My Imported Project" \
    # OPTIONAL: Emit detailed, verbose logs (off by default)
    --verbose \
    # OPTIONAL: Disable anonymous telemetry that gives the maintainers of this tool basic information about real-world usage.
    --disable-telemetry \
    # OPTIONAL: Skip verification of SSL certificates when connecting to GitHub. You may need to use this option if connecting to a GitHub Enterprise Server instance with a self-signed certificate, or if you have configured a proxy.
    --skip-certificate-verification \
    # OPTIONAL: Skip automatic check for updates to this tool
    --skip-update-check \
    # OPTIONAL: The number of an existing project you have already created to use as a migration target, importing the items and fields. If this is set, the project title in the export or specified with --project-title will not be applied.
    --project-number 1337
```

Watch out for `warn` lines in the logs, which will let you know about data which hasn't been imported.

Optionally, you can specify an existing project using `--project-number` to apply the fields and items to a project you've already created. This can be useful if you want to use a [project template](https://docs.github.com/en/issues/planning-and-tracking-with-projects/managing-your-project/managing-project-templates-in-your-organization) to set up your projects to overcome this tool's lack of support for migrating workflows and views.

### Authentication

For the commands [export](#step-3-export-your-project-from-migration-source) and [import](#step-6-import-your-project-into-your-migration-target), this tool supports two types of authentication: `token` which expects a Personal Access Token or `installation` which uses a GitHub App installation for authentication. The tool will automatically determine the authentication type based on the provided parameters.

- If a `--access-token` or `GITHUB_TOKEN` is provided it is assumed that the [token](#token-authentication) approach should be taken.
- If a `--app-installation-id` or `GITHUB_APP_INSTALLATION_ID` is provided it is assumed that the [installation](#installation-authentication) approach should be taken. This approach also requires that an `--app-id` and also `--private-key` be provided in addition to the `--app-installation-id`.

#### Token Authentication

By default, the extension expects an access token with appropriate scopes to be provided with the `--access-token` argument or `GITHUB_ACCESS_TOKEN` environment variable.

```bash
gh migrate-project export \
    # A GitHub access token with the permissions described above. This can also be configured using the `GITHUB_TOKEN` environment variable.
    --access-token GITHUB_TOKEN \
    # The login of the user or organization that owns the project
    --project-owner monalisa \
    # The type of the owner of the project you want to export (defaults to organization; only required if the owner is a user)
    --project-owner-type user \
    # The number of the project you want to export
    --project-number 1337
```

#### Installation Authentication

Instead of [token authentication](#token-authentication), installation authentication can be used by providing values for `--app-id`, `--app-installation-id`, and either `--private-key` or `--private-key-file`. Use of environment variables is also supported by providing `GITHUB_APP_ID`, `GITHUB_APP_INSTALLATION_ID`, and either `GITHUB_APP_PRIVATE_KEY` or `GITHUB_APP_PRIVATE_KEY_FILE`.

Installation Authentication uses a `GitHub App` to access resources on behalf of a user in an organization and can provide longer-lived integration. A [personal access token](#token-authentication) is great for short-lived scripts but if you have a large project you are trying to migrate you should consider using a GitHub App instead. Additionally, a personal access token is associated with a user and can cause the process to fail if the user no longer has access to the resources you are migrating. A GitHub App is not dependent on a user.

```bash
gh migrate-project export \
    # The GitHub app ID
    --app-id GITHUB_APP_ID \
    # The private key of the GitHub App. Alternatively, use --private-key-file if you have a .pem file.
    --private-key GITHUB_APP_PRIVATE_KEY \
    # OR
    # The private key of the GitHub App. For example, path to a *.pem file you downloaded from the about page of the GitHub App.
    --private-key-file /path/to/private-key-file.pem \
    # The GitHub app installation ID
    --app-installation-id GITHUB_APP_INSTALLATION_ID \
    # The login of the user or organization that owns the project
    --project-owner monalisa \
    # The type of the owner of the project you want to export (defaults to organization; only required if the owner is a user)
    --project-owner-type user \
    # The number of the project you want to export
    --project-number 1337
```

## Limitations

### Migrating a `Status` field with custom options to GitHub Enterprise Server requires manual steps

Due to limitations of the GitHub Enterprise Server GraphQL API, automatic migration of the `Status` field is not supported for imports to GitHub Enterprise Server if the `Status` field has custom options configured.

Due to this limitation, the tool will ask you to manually set up your options for the "Status" field mid-way through the import if the target is GitHub Enterprise Server. It will explain exactly what to do, and will validate that you've correctly copied the options from your migration source.

Once you've set up the "Status" field, your project will be imported.

### Classic projects are not supported

This tool can't migrate so-called classic Projects - only the newer version of [GitHub Projects](https://docs.github.com/en/issues/planning-and-tracking-with-projects).

Classic Projects can be migrated with [GitHub Enterprise Importer](https://docs.github.com/en/migrations/using-github-enterprise-importer) or [`ghe-migrator`](https://docs.github.com/en/enterprise-cloud@latest/migrations/using-ghe-migrator/about-ghe-migrator).

### Not all data is migrated

The following data is not migrated and will be skipped:

- Views
- The order of project items displayed in your views
- Workflows
- Iteration custom fields

You may want to add views and workflows to a template, manually create your project from a template, and then use the `import` command's `--project-number` option to import items and fields into that project.

### Supported GitHub Enterprise Server versions

This tool only commits to supporting [GitHub Enterprise Server releases supported by GitHub](https://docs.github.com/en/enterprise-server/admin/all-releases). Releases are deprecated roughly a year after release, and once a release is deprecated, we will drop support in this tool.

If you want to export from or import to an old GitHub Enterprise Server version, you may need to use an earlier version of the tool:

- For exports from and imports to GitHub Enterprise Server v3.11, use version `v3.2.0` or earlier (`gh extension install timrogers/gh-migrate-project --pin v3.2.0`)
- For exports from and imports to GitHub Enterprise Server v3.10, use version `v2.1.0` or earlier (`gh extension install timrogers/gh-migrate-project --pin v2.1.0`)
- For exports from GitHub Enterprise Server v3.7, v3.8 or v3.9, use version `v1.3.0` or earlier (`gh extension install timrogers/gh-migrate-project --pin v1.3.0`)

### Draft issues will show the person running the migration as the author

Migrated draft issues will show as being created by the person who ran the migration at the time they ran the migration. A note will be prepended to the body with original author login and timestamp.

## Troubleshooting

If you are connecting to a GitHub Enterprise Server instance with a self-signed certificate, or if you have configured a proxy, you may experience SSL/TLS related errors. You can skip certificate verification with the `--skip-certificate-verification` argument.

## Telemetry

This extension includes basic, anonymous telemetry to give the maintainers information about real-world usage. This data is limited to:

- The number of exports and imports being run
- The GitHub product you are exporting from or importing to
- The version of GitHub Enterprise Server being used, when exporting from or importing to GitHub Enterprise Server
- The versions of the extension currently in used

You can disable all telemetry by specifying the `--disable-telemetry` argument.
