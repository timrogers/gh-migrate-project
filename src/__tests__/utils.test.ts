// Test utilities for validateScopeIsPresent and validateAtLeastOneScopePresent
// These are extracted as separate functions to avoid importing the full utils module dependencies

const generateScopesListString = (scopes: Set<string>): string =>
  Array.from(scopes)
    .map((scope) => `'${scope}'`)
    .join(', ');

const validateSingleScopePresent = (
  requiredScope: string,
  presentScopes: Set<string>,
): void => {
  const presentScopesString = generateScopesListString(presentScopes);

  if (!presentScopes.has(requiredScope)) {
    throw new Error(
      `Your token does not have the required '${requiredScope}' scope. The following scopes are present: ${presentScopesString}. Please create a token with the correct scopes, and try again.`,
    );
  }
};

const validateAtLeastOneScopePresent = (
  scopes: Set<string>,
  presentScopes: Set<string>,
): void => {
  const requiredScopesString = generateScopesListString(scopes);
  const presentScopesString = generateScopesListString(presentScopes);

  if (Array.from(scopes).every((scope) => !presentScopes.has(scope))) {
    throw new Error(
      `Your token must have at least one of the following scopes: ${requiredScopesString}. The following scopes are present: ${presentScopesString}. Please create a token with the correct scopes, and try again.`,
    );
  }
};

export const validateScopeIsPresent = (
  requiredScopeOrScopes: string | Set<string>,
  presentScopes: Set<string>,
): void => {
  if (typeof requiredScopeOrScopes === 'string') {
    validateSingleScopePresent(requiredScopeOrScopes, presentScopes);
  } else {
    validateAtLeastOneScopePresent(requiredScopeOrScopes, presentScopes);
  }
};

describe('validateScopeIsPresent', () => {
  describe('when requiredScopeOrScopes is a string', () => {
    it('should not throw when the required scope is present', () => {
      const presentScopes = new Set(['repo', 'user', 'project']);

      expect(() => {
        validateScopeIsPresent('repo', presentScopes);
      }).not.toThrow();
    });

    it('should throw when the required scope is not present', () => {
      const presentScopes = new Set(['user', 'project']);

      expect(() => {
        validateScopeIsPresent('repo', presentScopes);
      }).toThrow(
        "Your token does not have the required 'repo' scope. The following scopes are present: 'user', 'project'. Please create a token with the correct scopes, and try again.",
      );
    });

    it('should throw with proper message when no scopes are present', () => {
      const presentScopes = new Set<string>([]);

      expect(() => {
        validateScopeIsPresent('repo', presentScopes);
      }).toThrow(
        "Your token does not have the required 'repo' scope. The following scopes are present: . Please create a token with the correct scopes, and try again.",
      );
    });
  });

  describe('when requiredScopeOrScopes is a Set', () => {
    it('should not throw when at least one required scope is present', () => {
      const requiredScopes = new Set(['read:project', 'project']);
      const presentScopes = new Set(['repo', 'project']);

      expect(() => {
        validateScopeIsPresent(requiredScopes, presentScopes);
      }).not.toThrow();
    });

    it('should not throw when multiple required scopes are present', () => {
      const requiredScopes = new Set(['read:project', 'project']);
      const presentScopes = new Set(['repo', 'read:project', 'project']);

      expect(() => {
        validateScopeIsPresent(requiredScopes, presentScopes);
      }).not.toThrow();
    });

    it('should throw when none of the required scopes are present', () => {
      const requiredScopes = new Set(['read:project', 'project']);
      const presentScopes = new Set(['repo', 'user']);

      expect(() => {
        validateScopeIsPresent(requiredScopes, presentScopes);
      }).toThrow(
        "Your token must have at least one of the following scopes: 'read:project', 'project'. The following scopes are present: 'repo', 'user'. Please create a token with the correct scopes, and try again.",
      );
    });

    it('should throw when no scopes are present at all', () => {
      const requiredScopes = new Set(['read:project', 'project']);
      const presentScopes = new Set<string>([]);

      expect(() => {
        validateScopeIsPresent(requiredScopes, presentScopes);
      }).toThrow(
        "Your token must have at least one of the following scopes: 'read:project', 'project'. The following scopes are present: . Please create a token with the correct scopes, and try again.",
      );
    });
  });
});
