import { type ProjectItem } from './graphql-types';

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
