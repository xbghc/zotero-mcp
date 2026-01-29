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
} from './types.js';

const ZOTERO_API_BASE = 'https://api.zotero.org';

// 默认请求间隔（毫秒），至少1秒
const DEFAULT_REQUEST_INTERVAL = 1000;

export class ZoteroClient {
  private config: ZoteroConfig;
  private libraryVersion: number | null = null;
  private lastRequestTime: number = 0;
  private backoffUntil: number = 0;
  private requestInterval: number = DEFAULT_REQUEST_INTERVAL;

  constructor(config: ZoteroConfig) {
    this.config = config;
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
   */
  async searchItems(params: SearchParams = {}): Promise<{
    items: ZoteroItem[];
    totalResults: number;
  }> {
    const path = params.collectionKey
      ? `${this.getLibraryPath()}/collections/${params.collectionKey}/items/top`
      : `${this.getLibraryPath()}/items/top`;

    const { data, headers } = await this.request<ZoteroItem[]>(path, {
      params: {
        q: params.query,
        itemType: params.itemType,
        tag: params.tag,
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
}
