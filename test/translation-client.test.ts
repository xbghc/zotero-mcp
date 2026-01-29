import { describe, it, expect, beforeAll } from 'vitest';
import { TranslationClient } from '../src/translation-client.js';

describe('TranslationClient', () => {
  let client: TranslationClient;
  let serverAvailable: boolean;

  beforeAll(async () => {
    const serverUrl = process.env.TRANSLATION_SERVER_URL || 'http://localhost:1969';
    client = new TranslationClient(serverUrl);
    serverAvailable = await client.isAvailable();
  });

  describe('isAvailable', () => {
    it('should check server availability', async () => {
      const available = await client.isAvailable();
      expect(typeof available).toBe('boolean');
    });
  });

  describe('search', () => {
    it('should fetch metadata by DOI', async () => {
      if (!serverAvailable) {
        console.log('Skipping: Translation Server not available');
        return;
      }

      // 使用一个常见的 DOI 进行测试
      const items = await client.search('10.1038/nature12373');

      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBeGreaterThan(0);
      expect(items[0]).toHaveProperty('itemType');
      expect(items[0]).toHaveProperty('title');
    });

    it('should fetch metadata by ISBN', async () => {
      if (!serverAvailable) {
        console.log('Skipping: Translation Server not available');
        return;
      }

      // 使用一个常见的 ISBN
      const items = await client.search('978-0-13-468599-1');

      expect(Array.isArray(items)).toBe(true);
    });
  });
});
