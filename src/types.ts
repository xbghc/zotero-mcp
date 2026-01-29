/**
 * Zotero MCP 类型定义
 */

// Zotero API 配置
export interface ZoteroConfig {
  apiKey: string;
  userId: string;
  groupId?: string;
}

// Translation Server 配置
export interface TranslationServerConfig {
  url: string;
}

// Zotero 创建者类型
export interface ZoteroCreator {
  creatorType: string;
  firstName?: string;
  lastName?: string;
  name?: string; // 用于机构作者
}

// Zotero 标签类型
export interface ZoteroTag {
  tag: string;
  type?: number; // 0=普通标签, 1=自动标签
}

// Zotero 项目数据
export interface ZoteroItemData {
  key?: string;
  version?: number;
  itemType: string;
  title?: string;
  creators?: ZoteroCreator[];
  abstractNote?: string;
  publicationTitle?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  date?: string;
  DOI?: string;
  ISSN?: string;
  ISBN?: string;
  url?: string;
  accessDate?: string;
  language?: string;
  tags?: ZoteroTag[];
  collections?: string[];
  relations?: Record<string, string | string[]>;
  deleted?: number; // 1 = 在垃圾箱中
  [key: string]: unknown;
}

// Zotero API 项目响应
export interface ZoteroItem {
  key: string;
  version: number;
  library: {
    type: string;
    id: number;
    name?: string;
  };
  links: {
    self: { href: string; type: string };
    alternate?: { href: string; type: string };
  };
  data: ZoteroItemData;
  meta?: {
    creatorSummary?: string;
    parsedDate?: string;
    numChildren?: number;
  };
}

// Zotero 分组数据
export interface ZoteroCollection {
  key: string;
  version: number;
  data: {
    key: string;
    name: string;
    parentCollection: string | false;
  };
}

// Zotero API 响应头
export interface ZoteroResponseHeaders {
  totalResults?: number;
  lastModifiedVersion?: number;
  backoff?: number;
  retryAfter?: number;
}

// Zotero API 写入响应
export interface ZoteroWriteResponse {
  success: Record<string, string>;
  unchanged: Record<string, string>;
  failed: Record<string, { code: number; message: string }>;
}

// 搜索参数
export interface SearchParams {
  query?: string;
  itemType?: string;
  tag?: string;
  collectionKey?: string;
  limit?: number;
  start?: number;
  sort?: string;
  direction?: 'asc' | 'desc';
}

// 创建项目参数
export interface CreateItemParams {
  itemType: string;
  title: string;
  creators?: ZoteroCreator[];
  date?: string;
  DOI?: string;
  url?: string;
  abstractNote?: string;
  publicationTitle?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  tags?: string[];
  collections?: string[];
}

// 通过标识符创建参数
export interface CreateByIdentifierParams {
  identifier: string;
  tags?: string[];
  collections?: string[];
}

// 导出参数
export interface ExportParams {
  itemKeys: string[];
  format: 'bibtex' | 'ris' | 'csljson' | 'bibliography' | 'coins' | 'refer' | 'tei';
  style?: string;
}

// 简化的项目信息（用于列表显示）
export interface ItemSummary {
  key: string;
  title: string;
  itemType: string;
  creators: string;
  date: string;
}

// 分组摘要
export interface CollectionSummary {
  key: string;
  name: string;
  parentCollection: string | false;
}

// 标签摘要
export interface TagSummary {
  tag: string;
  type: number;
}
