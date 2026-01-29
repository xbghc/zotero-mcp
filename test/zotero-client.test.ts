import { describe, it, expect, beforeAll } from 'vitest';
import { ZoteroClient } from '../src/zotero-client.js';

describe('ZoteroClient', () => {
  let client: ZoteroClient;

  beforeAll(() => {
    const apiKey = process.env.ZOTERO_API_KEY;
    const userId = process.env.ZOTERO_USER_ID;

    if (!apiKey || !userId) {
      throw new Error('ZOTERO_API_KEY and ZOTERO_USER_ID must be set');
    }

    client = new ZoteroClient({ apiKey, userId });
  });

  describe('searchItems', () => {
    it('should return items from the library', async () => {
      const result = await client.searchItems({ limit: 5 });

      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('totalResults');
      expect(Array.isArray(result.items)).toBe(true);
    });

    it('should respect limit parameter', async () => {
      const result = await client.searchItems({ limit: 2 });

      expect(result.items.length).toBeLessThanOrEqual(2);
    });
  });

  describe('getCollections', () => {
    it('should return collections', async () => {
      const collections = await client.getCollections();

      expect(Array.isArray(collections)).toBe(true);
    });
  });

  describe('getTags', () => {
    it('should return tags', async () => {
      const tags = await client.getTags(10);

      expect(Array.isArray(tags)).toBe(true);
    });
  });

  describe('getItemTemplate', () => {
    it('should return template for journalArticle', async () => {
      const template = await client.getItemTemplate('journalArticle');

      expect(template).toHaveProperty('itemType', 'journalArticle');
      expect(template).toHaveProperty('title');
    });

    it('should return template for book', async () => {
      const template = await client.getItemTemplate('book');

      expect(template).toHaveProperty('itemType', 'book');
    });
  });
});
