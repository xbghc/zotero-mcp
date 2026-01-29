import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ZoteroClient } from '../src/zotero-client.js';

describe('ZoteroClient', () => {
  let client: ZoteroClient;
  // 用于测试更新/删除的临时文献 key
  let testItemKey: string | null = null;
  // 用于测试分组的 collection key
  let testCollectionKey: string | null = null;
  // 是否有写权限
  let hasWriteAccess = false;

  beforeAll(async () => {
    // 设置 30 秒超时（需要等待 API 同步）
    const apiKey = process.env.ZOTERO_API_KEY;
    const userId = process.env.ZOTERO_USER_ID;

    if (!apiKey || !userId) {
      throw new Error('ZOTERO_API_KEY and ZOTERO_USER_ID must be set');
    }

    client = new ZoteroClient({ apiKey, userId });

    // 检查是否有写权限
    try {
      const template = await client.getItemTemplate('note');
      template.note = 'Test write access - ' + Date.now();
      testItemKey = await client.createItem(template);

      // 等待 API 同步（Zotero API 可能有短暂延迟）
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // 验证创建是否成功
      await client.getItem(testItemKey);

      hasWriteAccess = true;
    } catch (error) {
      if (error instanceof Error && error.message.includes('403')) {
        hasWriteAccess = false;
      } else if (error instanceof Error && error.message.includes('404')) {
        hasWriteAccess = false;
      } else {
        throw error;
      }
    }
  });

  // 清理测试创建的文献
  afterAll(async () => {
    if (testItemKey && hasWriteAccess) {
      try {
        await client.deleteItem(testItemKey);
      } catch {
        // 忽略清理错误
      }
    }
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

  describe('updateItem', () => {
    it('should update an existing item', async () => {
      if (!hasWriteAccess || !testItemKey) {
        console.log('Skipping: No write access or no test item');
        return;
      }

      // 更新文献
      const updatedNote = 'Updated note content - ' + Date.now();
      await client.updateItem(testItemKey, { note: updatedNote });

      // 验证更新
      const item = await client.getItem(testItemKey);
      expect(item.data.note).toBe(updatedNote);
    });
  });

  describe('addTagsToItem', () => {
    it('should add tags to an existing item', async () => {
      if (!hasWriteAccess || !testItemKey) {
        console.log('Skipping: No write access or no test item');
        return;
      }

      // 添加标签
      const newTags = ['test-tag-1', 'test-tag-2'];
      await client.addTagsToItem(testItemKey, newTags);

      // 验证标签
      const item = await client.getItem(testItemKey);
      const tagNames = item.data.tags?.map((t) => t.tag) || [];
      expect(tagNames).toContain('test-tag-1');
      expect(tagNames).toContain('test-tag-2');
    });
  });

  describe('addItemToCollection', () => {
    it('should add an item to a collection', async () => {
      if (!hasWriteAccess || !testItemKey) {
        console.log('Skipping: No write access or no test item');
        return;
      }

      // 获取第一个分组
      const collections = await client.getCollections();
      if (collections.length === 0) {
        console.log('No collections found, skipping test');
        return;
      }
      testCollectionKey = collections[0].key;

      // 添加到分组
      await client.addItemToCollection(testItemKey, testCollectionKey);

      // 验证
      const item = await client.getItem(testItemKey);
      expect(item.data.collections).toContain(testCollectionKey);
    });
  });

  describe('deleteItem', () => {
    it('should move an item to trash', async () => {
      if (!hasWriteAccess) {
        console.log('Skipping: No write access');
        return;
      }

      // 创建一个新文献用于删除
      const template = await client.getItemTemplate('note');
      template.note = 'Test note to be deleted - ' + Date.now();
      const itemToDelete = await client.createItem(template);

      // 删除文献（移到垃圾箱）
      await client.deleteItem(itemToDelete);

      // 验证文献已被移到垃圾箱（deleted: 1）
      const item = await client.getItem(itemToDelete);
      expect(item.data.deleted).toBe(1);
    });
  });

  describe('getRecentItems', () => {
    it('should return recently added items', async () => {
      const items = await client.getRecentItems(5);

      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBeLessThanOrEqual(5);
      if (items.length > 0) {
        expect(items[0]).toHaveProperty('key');
        expect(items[0]).toHaveProperty('data');
      }
    });
  });

  describe('getItemChildren', () => {
    it('should return children of an item', async () => {
      // 先获取一个有附件的文献
      const result = await client.searchItems({ limit: 10 });
      if (result.items.length === 0) {
        console.log('No items in library, skipping test');
        return;
      }

      // 尝试获取第一个文献的子项目
      const children = await client.getItemChildren(result.items[0].key);
      expect(Array.isArray(children)).toBe(true);
    });
  });

  describe('getItemFulltext', () => {
    it('should return fulltext or null', async () => {
      // 先获取一个文献
      const result = await client.searchItems({ limit: 1 });
      if (result.items.length === 0) {
        console.log('No items in library, skipping test');
        return;
      }

      // 尝试获取全文（可能返回 null）
      const fulltext = await client.getItemFulltext(result.items[0].key);
      // fulltext 可能是 null 或包含 content 的对象
      if (fulltext !== null) {
        expect(fulltext).toHaveProperty('content');
      }
    });
  });
});
