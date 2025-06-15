import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  GitHubProduct,
  supportsAutomaticStatusFieldMigration,
  MINIMUM_SUPPORTED_GITHUB_ENTERPRISE_SERVER_VERSION_FOR_STATUS_FIELD_MIGRATION,
} from '../src/github-products.ts';

describe('github-products.ts', () => {
  describe('supportsAutomaticStatusFieldMigration', () => {
    test('should return true for GitHub.com', () => {
      const result = supportsAutomaticStatusFieldMigration(GitHubProduct.DOTCOM);
      assert.strictEqual(result, true);
    });

    test('should return true for GitHub Enterprise Cloud with Data Residency', () => {
      const result = supportsAutomaticStatusFieldMigration(
        GitHubProduct.GITHUB_ENTERPRISE_CLOUD_WITH_DATA_RESIDENCY,
      );
      assert.strictEqual(result, true);
    });

    test('should return false for GHES without version', () => {
      const result = supportsAutomaticStatusFieldMigration(GitHubProduct.GHES);
      assert.strictEqual(result, false);
    });

    test('should return false for GHES with version below minimum', () => {
      const result = supportsAutomaticStatusFieldMigration(GitHubProduct.GHES, '3.16.0');
      assert.strictEqual(result, false);
    });

    test('should return true for GHES with version equal to minimum', () => {
      const result = supportsAutomaticStatusFieldMigration(
        GitHubProduct.GHES,
        MINIMUM_SUPPORTED_GITHUB_ENTERPRISE_SERVER_VERSION_FOR_STATUS_FIELD_MIGRATION,
      );
      assert.strictEqual(result, true);
    });

    test('should return true for GHES with version above minimum', () => {
      const result = supportsAutomaticStatusFieldMigration(GitHubProduct.GHES, '3.18.0');
      assert.strictEqual(result, true);
    });

    test('should handle prerelease versions correctly', () => {
      // Prerelease versions like 3.17.0-rc1 are considered less than 3.17.0 by semver
      const result = supportsAutomaticStatusFieldMigration(
        GitHubProduct.GHES,
        '3.17.0-rc1',
      );
      assert.strictEqual(result, false);
    });

    test('should throw error for GHES with invalid version string', () => {
      // The semver library throws an error for invalid version strings
      assert.throws(() => {
        supportsAutomaticStatusFieldMigration(GitHubProduct.GHES, 'invalid');
      }, /Invalid Version/);
    });
  });

  describe('Constants', () => {
    test('should have correct minimum version for status field migration', () => {
      assert.strictEqual(
        MINIMUM_SUPPORTED_GITHUB_ENTERPRISE_SERVER_VERSION_FOR_STATUS_FIELD_MIGRATION,
        '3.17.0',
      );
    });
  });
});
