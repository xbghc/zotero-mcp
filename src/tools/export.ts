/**
 * 导出相关的 MCP Tools
 */

import { z } from 'zod';
import { writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ZoteroClient } from '../zotero-client.js';

const FORMAT_EXTENSIONS: Record<string, string> = {
  bibtex: '.bib',
  ris: '.ris',
  csljson: '.json',
  bibliography: '.txt',
  coins: '.html',
  refer: '.txt',
  tei: '.xml',
};

/**
 * 注册导出相关的 Tools
 */
export function registerExportTools(server: McpServer, zoteroClient: ZoteroClient): void {
  // export_bibliography - 导出引用
  server.registerTool(
    'export_bibliography',
    {
      title: 'Export Bibliography',
      description: `Export items as formatted bibliography or citation data.

**Selection methods (use ONE):**
- itemKeys: Export specific items by their keys
- collectionKey: Export all items in a collection
- tag: Export all items with a specific tag
- query: Export items matching a search query
- exportAll: Export entire library (use with caution for large libraries)

**Formats:**
- bibtex: BibTeX format for LaTeX
- ris: RIS format for reference managers
- csljson: CSL JSON for citation processors
- bibliography: Formatted citation text (use 'style' parameter)

Common styles for bibliography: apa, chicago-author-date, ieee, vancouver, harvard

**Output:** Content is always saved to a file (to avoid flooding the conversation with large exports). Returns file path and summary.`,
      inputSchema: {
        // 选择方式（多选一）
        itemKeys: z.array(z.string()).optional().describe('Specific item keys to export'),
        collectionKey: z.string().optional().describe('Export all items in this collection'),
        tag: z.string().optional().describe('Export all items with this tag'),
        query: z.string().optional().describe('Export items matching this search query'),
        exportAll: z.boolean().optional().describe('Export entire library (may be slow for large libraries)'),
        // 导出格式
        format: z.enum(['bibtex', 'ris', 'csljson', 'bibliography', 'coins', 'refer', 'tei']).describe('Export format'),
        style: z.string().optional().describe('Citation style for bibliography format (e.g., apa, chicago-author-date, ieee)'),
        // 数量限制
        limit: z.number().min(1).max(500).optional().describe('Maximum items to export (default 100, max 500, ignored when exportAll=true)'),
        // 输出路径
        outputPath: z.string().optional().describe('File path to save the export. If not specified, saves to /tmp/zotero-export-{timestamp}{ext}'),
      },
    },
    async ({ itemKeys, collectionKey, tag, query, exportAll, format, style, limit, outputPath }) => {
      let keysToExport: string[] = [];
      const effectiveLimit = limit || 100;

      try {
        // 根据不同的选择方式获取 itemKeys
        if (itemKeys && itemKeys.length > 0) {
          // 直接指定 keys
          keysToExport = itemKeys;
        } else if (collectionKey) {
          // 按分组导出
          keysToExport = await getAllItemKeys(zoteroClient, { collectionKey }, effectiveLimit, !!exportAll);
        } else if (tag) {
          // 按标签导出
          keysToExport = await getAllItemKeys(zoteroClient, { tag }, effectiveLimit, !!exportAll);
        } else if (query) {
          // 按搜索条件导出
          keysToExport = await getAllItemKeys(zoteroClient, { query }, effectiveLimit, !!exportAll);
        } else if (exportAll) {
          // 导出全部
          keysToExport = await getAllItemKeys(zoteroClient, {}, effectiveLimit, true);
        } else {
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({
              success: false,
              error: 'Please provide one of: itemKeys, collectionKey, tag, query, or set exportAll=true',
            }, null, 2) }],
          };
        }

        if (keysToExport.length === 0) {
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({
              success: false,
              error: 'No items found matching the criteria',
            }, null, 2) }],
          };
        }

        const result = await zoteroClient.exportItems(keysToExport, format, style);

        // 确定输出路径
        const ext = FORMAT_EXTENSIONS[format] || '.txt';
        const filePath = outputPath || `/tmp/zotero-export-${Date.now()}${ext}`;

        // 确保目录存在并写入文件
        await mkdir(dirname(filePath), { recursive: true });
        await writeFile(filePath, result, 'utf-8');

        // 返回摘要信息
        const fileSize = Buffer.byteLength(result, 'utf-8');
        const summary = {
          success: true,
          filePath,
          itemCount: keysToExport.length,
          format,
          fileSize: fileSize > 1024 * 1024
            ? `${(fileSize / (1024 * 1024)).toFixed(2)} MB`
            : fileSize > 1024
              ? `${(fileSize / 1024).toFixed(1)} KB`
              : `${fileSize} B`,
        };

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(summary, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }, null, 2) }],
        };
      }
    }
  );
}

/**
 * 获取所有符合条件的 item keys（支持分页）
 */
async function getAllItemKeys(
  zoteroClient: ZoteroClient,
  params: { collectionKey?: string; tag?: string; query?: string },
  limit: number,
  fetchAll: boolean
): Promise<string[]> {
  const keys: string[] = [];
  const pageSize = 100; // Zotero API 单次最多 100 条
  let start = 0;
  let hasMore = true;

  while (hasMore) {
    const result = await zoteroClient.searchItems({
      ...params,
      limit: pageSize,
      start,
    });

    for (const item of result.items) {
      keys.push(item.key);
    }

    // 检查是否还有更多
    if (!fetchAll) {
      // 非全部导出模式，检查是否达到限制
      if (keys.length >= limit) {
        return keys.slice(0, limit);
      }
    }

    // 检查是否还有下一页
    if (result.items.length < pageSize || keys.length >= result.totalResults) {
      hasMore = false;
    } else {
      start += pageSize;
    }
  }

  return fetchAll ? keys : keys.slice(0, limit);
}
