import { test, describe } from 'node:test';
import assert from 'node:assert';
import { presentError, normalizeBaseUrl } from '../src/utils.ts';

// Mock logger for testing
const mockLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
};

describe('utils.ts', () => {
  describe('presentError', () => {
    test('should return string as-is when error is a string', () => {
      const result = presentError('Test error message');
      assert.strictEqual(result, 'Test error message');
    });

    test('should stringify non-string, non-RequestError, non-GraphqlResponseError objects', () => {
      const errorObj = { code: 'TEST_ERROR', message: 'Something went wrong' };
      const result = presentError(errorObj);
      assert.strictEqual(result, JSON.stringify(errorObj));
    });

    test('should handle null and undefined errors', () => {
      assert.strictEqual(presentError(null), 'null');
      assert.strictEqual(presentError(undefined), undefined);
    });

    test('should handle number errors', () => {
      assert.strictEqual(presentError(404), '404');
    });
  });

  describe('normalizeBaseUrl', () => {
    test('should remove trailing slash from base URL', () => {
      const result = normalizeBaseUrl('https://api.github.com/', mockLogger);
      assert.strictEqual(result, 'https://api.github.com');
    });

    test('should return URL as-is when no trailing slash', () => {
      const result = normalizeBaseUrl('https://api.github.com', mockLogger);
      assert.strictEqual(result, 'https://api.github.com');
    });

    test('should handle multiple trailing slashes', () => {
      const result = normalizeBaseUrl('https://example.com///', mockLogger);
      assert.strictEqual(result, 'https://example.com//');
    });

    test('should handle empty string', () => {
      const result = normalizeBaseUrl('', mockLogger);
      assert.strictEqual(result, '');
    });

    test('should handle single slash', () => {
      const result = normalizeBaseUrl('/', mockLogger);
      assert.strictEqual(result, '');
    });
  });
});
