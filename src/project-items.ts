import { DraftIssueProjectItem, type ProjectItem } from './graphql-types';

export const isDraftProjectItem = (
  projectItem: ProjectItem,
): projectItem is DraftIssueProjectItem => {
  return projectItem.content.__typename === 'DraftIssue';
};

export const getDraftIssueAssignees = (projectItems: ProjectItem[]): string[] => {
  const draftIssueProjectItems = projectItems.filter(isDraftProjectItem);

  return Array.from(
    new Set(
      draftIssueProjectItems.flatMap((projectItem) =>
        projectItem.content.assignees?.nodes.map((node) => node.login),
      ),
    ),
  );
};

export const getReferencedRepositories = (projectItems: ProjectItem[]): string[] => {
  const projectItemsReferencingRepository = projectItems.filter(
    (projectItem) =>
      projectItem.content.__typename === 'Issue' ||
      projectItem.content.__typename === 'PullRequest',
  );

  return Array.from(
    new Set(
      projectItemsReferencingRepository.map(
        (projectItem) => projectItem.content.repository.nameWithOwner,
      ),
    ),
  );
};
