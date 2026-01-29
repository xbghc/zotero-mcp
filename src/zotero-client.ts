/**
 * Zotero Web API 客户端
 */

import type {
  ZoteroConfig,
  ZoteroItem,
  ZoteroCollection,
  ZoteroResponseHeaders,
  ZoteroWriteResponse,
  ZoteroItemData,
  SearchParams,
  TagSummary,
  ZoteroSavedSearch,
} from './types.js';
import { CacheManager } from './cache.js';

const ZOTERO_API_BASE = 'https://api.zotero.org';

// 默认请求间隔（毫秒），至少1秒
const DEFAULT_REQUEST_INTERVAL = 1000;

export class ZoteroClient {
  private config: ZoteroConfig;
  private libraryVersion: number | null = null;
  private lastRequestTime: number = 0;
  private backoffUntil: number = 0;
  private requestInterval: number = DEFAULT_REQUEST_INTERVAL;
  private cacheManager: CacheManager;

  constructor(config: ZoteroConfig) {
    this.config = config;
    const libraryType = config.groupId ? 'group' : 'user';
    const libraryId = config.groupId || config.userId;
    this.cacheManager = new CacheManager(libraryType, libraryId);
  }

  /**
   * 主动限流：等待直到可以发送下一个请求
   */
  private async throttle(): Promise<void> {
    const now = Date.now();

    // 检查是否在 backoff 期间
    if (now < this.backoffUntil) {
      const waitTime = this.backoffUntil - now;
      await this.sleep(waitTime);
    }

    // 确保请求间隔
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.requestInterval) {
      await this.sleep(this.requestInterval - elapsed);
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * 睡眠指定毫秒
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 获取库的基础路径
   */
  private getLibraryPath(): string {
    if (this.config.groupId) {
      return `/groups/${this.config.groupId}`;
    }
    return `/users/${this.config.userId}`;
  }

  /**
   * 解析响应头
   */
  private parseHeaders(headers: Headers): ZoteroResponseHeaders {
    return {
      totalResults: headers.get('Total-Results')
        ? parseInt(headers.get('Total-Results')!, 10)
        : undefined,
      lastModifiedVersion: headers.get('Last-Modified-Version')
        ? parseInt(headers.get('Last-Modified-Version')!, 10)
        : undefined,
      backoff: headers.get('Backoff')
        ? parseInt(headers.get('Backoff')!, 10)
        : undefined,
      retryAfter: headers.get('Retry-After')
        ? parseInt(headers.get('Retry-After')!, 10)
        : undefined,
    };
  }

  /**
   * 发送 API 请求
   */
  private async request<T>(
    path: string,
    options: {
      method?: string;
      params?: Record<string, string | number | undefined>;
      body?: unknown;
      requireVersion?: boolean;
    } = {}
  ): Promise<{ data: T; headers: ZoteroResponseHeaders }> {
    const { method = 'GET', params, body, requireVersion = false } = options;

    // 构建 URL
    const url = new URL(`${ZOTERO_API_BASE}${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    // 构建请求头
    const headers: Record<string, string> = {
      'Zotero-API-Key': this.config.apiKey,
      'Zotero-API-Version': '3',
    };

    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    if (requireVersion && this.libraryVersion !== null) {
      headers['If-Unmodified-Since-Version'] = String(this.libraryVersion);
    }

    // 主动限流
    await this.throttle();

    // 发送请求
    const response = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    // 解析响应头
    const responseHeaders = this.parseHeaders(response.headers);

    // 更新库版本
    if (responseHeaders.lastModifiedVersion !== undefined) {
      this.libraryVersion = responseHeaders.lastModifiedVersion;
    }

    // 处理 Backoff 头（服务器建议等待）
    if (responseHeaders.backoff) {
      this.backoffUntil = Date.now() + responseHeaders.backoff * 1000;
    }

    // 处理速率限制
    if (response.status === 429) {
      const waitTime = responseHeaders.retryAfter || responseHeaders.backoff || 5;
      this.backoffUntil = Date.now() + waitTime * 1000;
      throw new Error(`Rate limited. Please wait ${waitTime} seconds.`);
    }

    // 处理错误
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Zotero API error (${response.status}): ${errorText}`);
    }

    // 解析响应体
    const contentType = response.headers.get('Content-Type') || '';
    let data: T;
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = (await response.text()) as T;
    }

    return { data, headers: responseHeaders };
  }

  /**
   * 搜索文献
   * @param params.qmode - 'everything' 可搜索笔记内容和全文
   * @param params.includeChildren - true 时包含子项目（笔记、附件）
   * @param params.includeTrashed - true 时包含垃圾箱项目
   */
  async searchItems(params: SearchParams = {}): Promise<{
    items: ZoteroItem[];
    totalResults: number;
  }> {
    // 根据 includeChildren 选择端点
    let path: string;
    if (params.collectionKey) {
      path = params.includeChildren
        ? `${this.getLibraryPath()}/collections/${params.collectionKey}/items`
        : `${this.getLibraryPath()}/collections/${params.collectionKey}/items/top`;
    } else {
      path = params.includeChildren
        ? `${this.getLibraryPath()}/items`
        : `${this.getLibraryPath()}/items/top`;
    }

    const { data, headers } = await this.request<ZoteroItem[]>(path, {
      params: {
        q: params.query,
        qmode: params.qmode,
        itemType: params.itemType,
        tag: params.tag,
        includeTrashed: params.includeTrashed ? 1 : undefined,
        limit: params.limit || 25,
        start: params.start || 0,
        sort: params.sort || 'dateModified',
        direction: params.direction || 'desc',
      },
    });

    return {
      items: data,
      totalResults: headers.totalResults || data.length,
    };
  }

  /**
   * 获取单个文献详情
   */
  async getItem(itemKey: string): Promise<ZoteroItem> {
    const path = `${this.getLibraryPath()}/items/${itemKey}`;
    const { data } = await this.request<ZoteroItem>(path);
    return data;
  }

  /**
   * 获取所有分组
   */
  async getCollections(parentKey?: string): Promise<ZoteroCollection[]> {
    const path = parentKey
      ? `${this.getLibraryPath()}/collections/${parentKey}/collections`
      : `${this.getLibraryPath()}/collections`;

    const { data } = await this.request<ZoteroCollection[]>(path, {
      params: { limit: 100 },
    });

    return data;
  }

  /**
   * 获取单个分组详情
   */
  async getCollection(collectionKey: string): Promise<ZoteroCollection> {
    const path = `${this.getLibraryPath()}/collections/${collectionKey}`;
    const { data } = await this.request<ZoteroCollection>(path);
    return data;
  }

  /**
   * 创建分组
   */
  async createCollection(name: string, parentCollection?: string): Promise<string> {
    await this.getLibraryVersion();

    const path = `${this.getLibraryPath()}/collections`;
    const collectionData: { name: string; parentCollection?: string | false } = { name };
    if (parentCollection) {
      collectionData.parentCollection = parentCollection;
    }

    const { data } = await this.request<ZoteroWriteResponse>(path, {
      method: 'POST',
      body: [collectionData],
      requireVersion: true,
    });

    if (Object.keys(data.success).length > 0) {
      return data.success['0'];
    }

    if (Object.keys(data.failed).length > 0) {
      const error = data.failed['0'];
      throw new Error(`Failed to create collection: ${error.message}`);
    }

    throw new Error('Unknown error creating collection');
  }

  /**
   * 更新分组
   */
  async updateCollection(
    collectionKey: string,
    updates: { name?: string; parentCollection?: string | false }
  ): Promise<void> {
    // 获取当前分组以获取版本号
    const collection = await this.getCollection(collectionKey);
    const currentVersion = collection.version;

    const path = `${this.getLibraryPath()}/collections/${collectionKey}`;
    const url = new URL(`${ZOTERO_API_BASE}${path}`);
    const headers: Record<string, string> = {
      'Zotero-API-Key': this.config.apiKey,
      'Zotero-API-Version': '3',
      'Content-Type': 'application/json',
      'If-Unmodified-Since-Version': String(currentVersion),
    };

    const body = {
      key: collectionKey,
      version: currentVersion,
      name: updates.name ?? collection.data.name,
      parentCollection: updates.parentCollection ?? collection.data.parentCollection,
    };

    await this.throttle();
    const response = await fetch(url.toString(), {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Zotero API error (${response.status}): ${errorText}`);
    }

    const newVersion = response.headers.get('Last-Modified-Version');
    if (newVersion) {
      this.libraryVersion = parseInt(newVersion, 10);
    }
  }

  /**
   * 删除分组
   */
  async deleteCollection(collectionKey: string): Promise<void> {
    // 获取当前分组以获取版本号
    const collection = await this.getCollection(collectionKey);
    const currentVersion = collection.version;

    const path = `${this.getLibraryPath()}/collections/${collectionKey}`;
    const url = new URL(`${ZOTERO_API_BASE}${path}`);
    const headers: Record<string, string> = {
      'Zotero-API-Key': this.config.apiKey,
      'Zotero-API-Version': '3',
      'If-Unmodified-Since-Version': String(currentVersion),
    };

    await this.throttle();
    const response = await fetch(url.toString(), {
      method: 'DELETE',
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Zotero API error (${response.status}): ${errorText}`);
    }

    const newVersion = response.headers.get('Last-Modified-Version');
    if (newVersion) {
      this.libraryVersion = parseInt(newVersion, 10);
    }
  }

  /**
   * 获取所有标签
   */
  async getTags(limit: number = 50): Promise<TagSummary[]> {
    const path = `${this.getLibraryPath()}/tags`;
    const { data } = await this.request<Array<{ tag: string; meta: { type: number } }>>(
      path,
      { params: { limit } }
    );

    return data.map((t) => ({
      tag: t.tag,
      type: t.meta.type,
    }));
  }

  /**
   * 创建文献
   */
  async createItem(itemData: ZoteroItemData): Promise<string> {
    // 先获取当前库版本
    await this.getLibraryVersion();

    const path = `${this.getLibraryPath()}/items`;

    const { data } = await this.request<ZoteroWriteResponse>(path, {
      method: 'POST',
      body: [itemData],
      requireVersion: true,
    });

    if (Object.keys(data.success).length > 0) {
      return data.success['0'];
    }

    if (Object.keys(data.failed).length > 0) {
      const error = data.failed['0'];
      throw new Error(`Failed to create item: ${error.message}`);
    }

    throw new Error('Unknown error creating item');
  }

  /**
   * 获取库版本
   */
  private async getLibraryVersion(): Promise<number> {
    if (this.libraryVersion !== null) {
      return this.libraryVersion;
    }

    const path = `${this.getLibraryPath()}/items`;
    const { headers } = await this.request<ZoteroItem[]>(path, {
      params: { limit: 1 },
    });

    this.libraryVersion = headers.lastModifiedVersion || 0;
    return this.libraryVersion;
  }

  /**
   * 获取项目模板
   */
  async getItemTemplate(itemType: string): Promise<ZoteroItemData> {
    const { data } = await this.request<ZoteroItemData>('/items/new', {
      params: { itemType },
    });
    return data;
  }

  /**
   * 导出文献为指定格式
   */
  async exportItems(
    itemKeys: string[],
    format: string,
    style?: string
  ): Promise<string> {
    const path = `${this.getLibraryPath()}/items`;
    const params: Record<string, string | number | undefined> = {
      itemKey: itemKeys.join(','),
      format,
    };

    if (style && format === 'bibliography') {
      params.style = style;
    }

    const { data } = await this.request<string>(path, { params });
    return data;
  }

  /**
   * 更新文献
   */
  async updateItem(
    itemKey: string,
    updates: Partial<ZoteroItemData>
  ): Promise<void> {
    // 先获取当前文献以获取版本号
    const item = await this.getItem(itemKey);
    const currentVersion = item.version;

    // PATCH 请求需要在请求头中包含版本号
    const path = `${this.getLibraryPath()}/items/${itemKey}`;
    const url = new URL(`${ZOTERO_API_BASE}${path}`);
    const headers: Record<string, string> = {
      'Zotero-API-Key': this.config.apiKey,
      'Zotero-API-Version': '3',
      'Content-Type': 'application/json',
      'If-Unmodified-Since-Version': String(currentVersion),
    };

    await this.throttle();
    const response = await fetch(url.toString(), {
      method: 'PATCH',
      headers,
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Zotero API error (${response.status}): ${errorText}`);
    }

    // 更新本地版本号
    const newVersion = response.headers.get('Last-Modified-Version');
    if (newVersion) {
      this.libraryVersion = parseInt(newVersion, 10);
    }
  }

  /**
   * 删除文献（移到垃圾箱）
   * 通过设置 deleted: 1 将文献移到垃圾箱，而不是永久删除
   */
  async deleteItem(itemKey: string): Promise<void> {
    // 使用 PATCH 设置 deleted: 1 来移动到垃圾箱
    await this.updateItem(itemKey, { deleted: 1 } as Partial<ZoteroItemData>);
  }

  /**
   * 获取最近添加的文献
   */
  async getRecentItems(limit: number = 10): Promise<ZoteroItem[]> {
    const path = `${this.getLibraryPath()}/items/top`;
    const { data } = await this.request<ZoteroItem[]>(path, {
      params: {
        sort: 'dateAdded',
        direction: 'desc',
        limit,
      },
    });
    return data;
  }

  /**
   * 获取文献的子项目（附件、笔记等）
   */
  async getItemChildren(itemKey: string): Promise<ZoteroItem[]> {
    const path = `${this.getLibraryPath()}/items/${itemKey}/children`;
    const { data } = await this.request<ZoteroItem[]>(path);
    return data;
  }

  /**
   * 获取文献的全文内容（支持分段）
   * @param itemKey 文献 key
   * @param offset 起始字符位置（默认 0）
   * @param limit 返回字符数（默认 10000，最大 50000）
   */
  async getItemFulltext(
    itemKey: string,
    offset: number = 0,
    limit: number = 10000
  ): Promise<{
    content: string;
    offset: number;
    length: number;
    totalChars: number;
    hasMore: boolean;
    nextOffset: number | null;
    indexedPages?: number;
    totalPages?: number;
  } | null> {
    const path = `${this.getLibraryPath()}/items/${itemKey}/fulltext`;
    try {
      const { data } = await this.request<{
        content: string;
        indexedPages?: number;
        totalPages?: number;
        indexedChars?: number;
        totalChars?: number;
      }>(path);

      const fullContent = data.content || '';
      const totalChars = fullContent.length;

      // 确保 limit 在合理范围内
      const actualLimit = Math.min(Math.max(limit, 1000), 50000);

      // 确保 offset 在有效范围内
      const actualOffset = Math.min(Math.max(offset, 0), totalChars);

      // 截取内容
      const slicedContent = fullContent.slice(actualOffset, actualOffset + actualLimit);
      const hasMore = actualOffset + slicedContent.length < totalChars;

      return {
        content: slicedContent,
        offset: actualOffset,
        length: slicedContent.length,
        totalChars,
        hasMore,
        nextOffset: hasMore ? actualOffset + slicedContent.length : null,
        indexedPages: data.indexedPages,
        totalPages: data.totalPages,
      };
    } catch (error) {
      // 404 表示没有全文内容
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  /**
   * 为文献添加标签
   */
  async addTagsToItem(itemKey: string, tags: string[]): Promise<void> {
    // 获取当前文献
    const item = await this.getItem(itemKey);
    const existingTags = item.data.tags || [];

    // 合并标签（去重）
    const existingTagNames = new Set(existingTags.map((t) => t.tag));
    const newTags = tags.filter((tag) => !existingTagNames.has(tag));
    const mergedTags = [
      ...existingTags,
      ...newTags.map((tag) => ({ tag })),
    ];

    // 更新文献
    await this.updateItem(itemKey, { tags: mergedTags });
  }

  /**
   * 将文献添加到分组
   */
  async addItemToCollection(
    itemKey: string,
    collectionKey: string
  ): Promise<void> {
    // 获取当前文献
    const item = await this.getItem(itemKey);
    const existingCollections = item.data.collections || [];

    // 检查是否已在该分组
    if (existingCollections.includes(collectionKey)) {
      return; // 已经在分组中
    }

    // 添加到分组
    const mergedCollections = [...existingCollections, collectionKey];

    // 更新文献
    await this.updateItem(itemKey, { collections: mergedCollections });
  }

  /**
   * 获取垃圾箱中的文献
   */
  async getTrashItems(limit: number = 25): Promise<ZoteroItem[]> {
    const path = `${this.getLibraryPath()}/items/trash`;
    const { data } = await this.request<ZoteroItem[]>(path, {
      params: {
        limit,
        sort: 'dateModified',
        direction: 'desc',
      },
    });
    return data;
  }

  /**
   * 获取保存的搜索
   */
  async getSavedSearches(): Promise<ZoteroSavedSearch[]> {
    const path = `${this.getLibraryPath()}/searches`;
    const { data } = await this.request<ZoteroSavedSearch[]>(path);
    return data;
  }

  /**
   * 下载附件文件（支持缓存）
   * @param itemKey 附件的 key
   * @param options.force 强制重新下载，忽略缓存
   * @returns 本地文件路径和元数据
   */
  async downloadAttachment(
    itemKey: string,
    options: { force?: boolean } = {}
  ): Promise<{
    path: string;
    filename: string;
    contentType: string;
    size: number;
    fromCache: boolean;
  }> {
    // 获取附件信息以验证类型和获取版本号
    const item = await this.getItem(itemKey);

    if (item.data.itemType !== 'attachment') {
      throw new Error(`Item ${itemKey} is not an attachment (type: ${item.data.itemType})`);
    }

    // 只支持存储的文件附件
    const linkMode = item.data.linkMode;
    if (linkMode !== 'imported_file' && linkMode !== 'imported_url') {
      throw new Error(
        `Attachment ${itemKey} is not a stored file (linkMode: ${linkMode}). ` +
        `Only imported_file and imported_url attachments can be downloaded.`
      );
    }

    const filename = item.data.filename || `${itemKey}.bin`;
    const contentType = item.data.contentType || 'application/octet-stream';
    const version = item.version;

    // 检查缓存（除非强制刷新）
    if (!options.force) {
      const isValid = await this.cacheManager.isValid(itemKey, version);
      if (isValid) {
        const cachedPath = await this.cacheManager.getCachedFilePath(itemKey);
        if (cachedPath) {
          const meta = await this.cacheManager.getMeta(itemKey);
          return {
            path: cachedPath,
            filename: meta!.filename,
            contentType: meta!.contentType,
            size: meta!.size,
            fromCache: true,
          };
        }
      }
    }

    // 从 API 下载文件
    const path = `${this.getLibraryPath()}/items/${itemKey}/file`;
    const url = `${ZOTERO_API_BASE}${path}`;

    await this.throttle();

    const response = await fetch(url, {
      headers: {
        'Zotero-API-Key': this.config.apiKey,
        'Zotero-API-Version': '3',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to download attachment (${response.status}): ${errorText}`);
    }

    // 获取文件内容
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 保存到缓存
    const savedPath = await this.cacheManager.save(itemKey, filename, buffer, {
      version,
      filename,
      contentType,
      size: buffer.length,
    });

    return {
      path: savedPath,
      filename,
      contentType,
      size: buffer.length,
      fromCache: false,
    };
  }

  /**
   * 清除附件缓存
   * @param itemKey 可选，指定则只清除该项目的缓存，否则清除所有
   */
  async clearAttachmentCache(itemKey?: string): Promise<void> {
    if (itemKey) {
      await this.cacheManager.invalidate(itemKey);
    } else {
      await this.cacheManager.clearAll();
    }
  }
}
