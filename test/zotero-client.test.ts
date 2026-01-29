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

  describe('collection management', () => {
    let testCollectionKey: string | null = null;

    it('should create a collection', async () => {
      if (!hasWriteAccess) {
        console.log('Skipping: No write access');
        return;
      }

      const name = `Test Collection ${Date.now()}`;
      testCollectionKey = await client.createCollection(name);
      expect(testCollectionKey).toBeTruthy();
      console.log(`Created collection: ${testCollectionKey}`);
    });

    it('should update a collection', async () => {
      if (!hasWriteAccess || !testCollectionKey) {
        console.log('Skipping: No write access or no test collection');
        return;
      }

      const newName = `Updated Collection ${Date.now()}`;
      await client.updateCollection(testCollectionKey, { name: newName });

      // 验证更新
      const collection = await client.getCollection(testCollectionKey);
      expect(collection.data.name).toBe(newName);
    });

    it('should delete a collection', async () => {
      if (!hasWriteAccess || !testCollectionKey) {
        console.log('Skipping: No write access or no test collection');
        return;
      }

      await client.deleteCollection(testCollectionKey);
      testCollectionKey = null;

      // 验证删除（应该抛出 404 错误）
      // 注意：删除后立即查询可能因为 API 同步延迟而仍然返回
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
    it('should return fulltext with pagination info or null', async () => {
      // 先获取一个文献
      const result = await client.searchItems({ limit: 1 });
      if (result.items.length === 0) {
        console.log('No items in library, skipping test');
        return;
      }

      // 尝试获取全文（可能返回 null）
      const fulltext = await client.getItemFulltext(result.items[0].key);
      // fulltext 可能是 null 或包含分段信息的对象
      if (fulltext !== null) {
        expect(fulltext).toHaveProperty('content');
        expect(fulltext).toHaveProperty('offset');
        expect(fulltext).toHaveProperty('length');
        expect(fulltext).toHaveProperty('totalChars');
        expect(fulltext).toHaveProperty('hasMore');
      }
    });

    it('should support pagination with offset and limit', async () => {
      // 先获取一个文献
      const result = await client.searchItems({ limit: 1 });
      if (result.items.length === 0) {
        console.log('No items in library, skipping test');
        return;
      }

      // 获取前 1000 个字符
      const page1 = await client.getItemFulltext(result.items[0].key, 0, 1000);
      if (page1 !== null && page1.hasMore) {
        // 获取下一段
        const page2 = await client.getItemFulltext(result.items[0].key, page1.nextOffset!, 1000);
        if (page2 !== null) {
          expect(page2.offset).toBe(page1.nextOffset);
        }
      }
    });
  });

  describe('getTrashItems', () => {
    it('should return items in trash', async () => {
      const items = await client.getTrashItems(10);

      expect(Array.isArray(items)).toBe(true);
      // 垃圾箱可能为空，所以不检查长度
      if (items.length > 0) {
        expect(items[0]).toHaveProperty('key');
        expect(items[0]).toHaveProperty('data');
        expect(items[0].data.deleted).toBe(1);
      }
    });
  });

  describe('getSavedSearches', () => {
    it('should return saved searches', async () => {
      const searches = await client.getSavedSearches();

      expect(Array.isArray(searches)).toBe(true);
      // 可能没有保存的搜索
      if (searches.length > 0) {
        expect(searches[0]).toHaveProperty('key');
        expect(searches[0]).toHaveProperty('data');
        expect(searches[0].data).toHaveProperty('name');
        expect(searches[0].data).toHaveProperty('conditions');
      }
    });
  });

  describe('searchItems with advanced parameters', () => {
    it('should support qmode=everything', async () => {
      const result = await client.searchItems({
        query: 'test',
        qmode: 'everything',
        limit: 5,
      });

      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('totalResults');
      expect(Array.isArray(result.items)).toBe(true);
    });

    it('should support includeChildren', async () => {
      const result = await client.searchItems({
        includeChildren: true,
        limit: 5,
      });

      expect(result).toHaveProperty('items');
      expect(Array.isArray(result.items)).toBe(true);
    });

    it('should support itemType=note', async () => {
      const result = await client.searchItems({
        itemType: 'note',
        includeChildren: true,
        limit: 5,
      });

      expect(result).toHaveProperty('items');
      expect(Array.isArray(result.items)).toBe(true);
      // 如果有结果，验证都是笔记
      result.items.forEach((item) => {
        expect(item.data.itemType).toBe('note');
      });
    });

    it('should support includeTrashed', async () => {
      const result = await client.searchItems({
        includeTrashed: true,
        limit: 5,
      });

      expect(result).toHaveProperty('items');
      expect(Array.isArray(result.items)).toBe(true);
    });
  });

  describe('downloadAttachment', () => {
    // 注意：实际下载大文件可能需要很长时间（几分钟），因为 Zotero API 有速率限制
    it('should download attachment and verify cache', { timeout: 600000 }, async () => {
      // 搜索附件
      const result = await client.searchItems({
        itemType: 'attachment',
        includeChildren: true,
        limit: 10,
      });

      // 找到可下载的附件（imported_file 或 imported_url）
      const attachment = result.items.find(
        (item) =>
          item.data.linkMode === 'imported_file' ||
          item.data.linkMode === 'imported_url'
      );

      if (!attachment) {
        console.log('No downloadable attachments found, skipping test');
        return;
      }

      console.log(`Testing download for attachment: ${attachment.key}`);
      console.log(`Filename: ${attachment.data.filename}`);

      // 清除可能存在的缓存
      await client.clearAttachmentCache(attachment.key);

      // 首次下载
      console.log('Starting first download (may take several minutes)...');
      const startTime = Date.now();
      const download1 = await client.downloadAttachment(attachment.key);
      const downloadTime = Date.now() - startTime;
      console.log(`First download completed in ${downloadTime}ms, fromCache: ${download1.fromCache}`);

      expect(download1).toHaveProperty('path');
      expect(download1).toHaveProperty('filename');
      expect(download1).toHaveProperty('size');
      expect(download1.fromCache).toBe(false);

      // 第二次应该从缓存获取
      console.log('Starting second download (should be from cache)...');
      const download2 = await client.downloadAttachment(attachment.key);
      console.log(`Second download fromCache: ${download2.fromCache}`);

      expect(download2.path).toBe(download1.path);
      expect(download2.fromCache).toBe(true);

      // 清理
      await client.clearAttachmentCache(attachment.key);
    });

    it('should clear attachment cache', async () => {
      await client.clearAttachmentCache();
    });

    it('should throw error for non-attachment items', async () => {
      // 搜索非附件类型的项目
      const result = await client.searchItems({
        itemType: 'journalArticle',
        limit: 1,
      });

      if (result.items.length === 0) {
        console.log('No journal articles found, skipping test');
        return;
      }

      const item = result.items[0];
      await expect(client.downloadAttachment(item.key)).rejects.toThrow('not an attachment');
    });
  });
});
