/**
 * 缓存管理模块
 * 支持跨平台的缓存目录管理
 */

import { homedir, tmpdir, platform } from 'os';
import { join, dirname } from 'path';
import { mkdir, readFile, writeFile, stat, rm } from 'fs/promises';

export interface CacheMeta {
  version: number;
  downloadedAt: string;
  filename: string;
  contentType: string;
  size: number;
}

/**
 * 获取跨平台的缓存目录
 */
export function getCacheDir(): string {
  // 优先使用环境变量指定的缓存目录
  if (process.env.ZOTERO_MCP_CACHE_DIR) {
    return process.env.ZOTERO_MCP_CACHE_DIR;
  }

  // XDG 规范
  if (process.env.XDG_CACHE_HOME) {
    return join(process.env.XDG_CACHE_HOME, 'zotero-mcp');
  }

  // 按平台选择默认目录
  switch (platform()) {
    case 'darwin':
      return join(homedir(), 'Library', 'Caches', 'zotero-mcp');
    case 'win32':
      return join(process.env.LOCALAPPDATA || tmpdir(), 'zotero-mcp', 'cache');
    default: // linux 和其他 Unix 系统
      return join(homedir(), '.cache', 'zotero-mcp');
  }
}

/**
 * 缓存管理器
 */
export class CacheManager {
  private cacheDir: string;
  private libraryPrefix: string;

  constructor(libraryType: 'user' | 'group', libraryId: string) {
    this.cacheDir = getCacheDir();
    this.libraryPrefix = `${libraryType}_${libraryId}`;
  }

  /**
   * 获取项目的缓存目录
   */
  private getItemCacheDir(itemKey: string): string {
    return join(this.cacheDir, 'files', this.libraryPrefix, itemKey);
  }

  /**
   * 获取元数据文件路径
   */
  private getMetaPath(itemKey: string): string {
    return join(this.getItemCacheDir(itemKey), '.meta.json');
  }

  /**
   * 读取缓存元数据
   */
  async getMeta(itemKey: string): Promise<CacheMeta | null> {
    try {
      const metaPath = this.getMetaPath(itemKey);
      const content = await readFile(metaPath, 'utf-8');
      return JSON.parse(content) as CacheMeta;
    } catch {
      return null;
    }
  }

  /**
   * 检查缓存是否有效
   */
  async isValid(itemKey: string, currentVersion: number): Promise<boolean> {
    const meta = await this.getMeta(itemKey);
    if (!meta) return false;

    // 检查版本是否匹配
    if (meta.version !== currentVersion) return false;

    // 检查文件是否存在
    const filePath = join(this.getItemCacheDir(itemKey), meta.filename);
    try {
      await stat(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取缓存文件路径
   */
  async getCachedFilePath(itemKey: string): Promise<string | null> {
    const meta = await this.getMeta(itemKey);
    if (!meta) return null;

    const filePath = join(this.getItemCacheDir(itemKey), meta.filename);
    try {
      await stat(filePath);
      return filePath;
    } catch {
      return null;
    }
  }

  /**
   * 保存文件到缓存
   */
  async save(
    itemKey: string,
    filename: string,
    content: Buffer,
    meta: Omit<CacheMeta, 'downloadedAt'>
  ): Promise<string> {
    const itemDir = this.getItemCacheDir(itemKey);

    // 创建目录
    await mkdir(itemDir, { recursive: true });

    // 保存文件
    const filePath = join(itemDir, filename);
    await writeFile(filePath, content);

    // 保存元数据
    const fullMeta: CacheMeta = {
      ...meta,
      downloadedAt: new Date().toISOString(),
    };
    await writeFile(this.getMetaPath(itemKey), JSON.stringify(fullMeta, null, 2));

    return filePath;
  }

  /**
   * 删除项目缓存
   */
  async invalidate(itemKey: string): Promise<void> {
    const itemDir = this.getItemCacheDir(itemKey);
    try {
      await rm(itemDir, { recursive: true });
    } catch {
      // 忽略不存在的目录
    }
  }

  /**
   * 清理所有缓存
   */
  async clearAll(): Promise<void> {
    const filesDir = join(this.cacheDir, 'files', this.libraryPrefix);
    try {
      await rm(filesDir, { recursive: true });
    } catch {
      // 忽略不存在的目录
    }
  }
}
