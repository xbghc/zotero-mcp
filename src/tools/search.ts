/**
 * 搜索和查询相关的 MCP Tools
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ZoteroClient } from '../zotero-client.js';
import type { ItemSummary } from '../types.js';

/**
 * 将 ZoteroItem 转换为简化的摘要格式
 */
function formatItemSummary(item: { key: string; data: { title?: string; itemType: string; creators?: Array<{ firstName?: string; lastName?: string; name?: string }>; date?: string } }): ItemSummary {
  const creators = item.data.creators || [];
  const creatorStr = creators
    .map((c) => c.name || `${c.lastName || ''}${c.firstName ? ', ' + c.firstName : ''}`)
    .join('; ');

  return {
    key: item.key,
    title: item.data.title || '(No title)',
    itemType: item.data.itemType,
    creators: creatorStr || '(No authors)',
    date: item.data.date || '',
  };
}

/**
 * 注册搜索相关的 Tools
 */
export function registerSearchTools(server: McpServer, zoteroClient: ZoteroClient): void {
  // search_items - 搜索文献
  server.tool(
    'search_items',
    'Search items in the Zotero library',
    {
      query: z.string().optional().describe('Search keywords'),
      itemType: z.string().optional().describe('Filter by item type (e.g., journalArticle, book)'),
      tag: z.string().optional().describe('Filter by tag'),
      collectionKey: z.string().optional().describe('Filter by collection key'),
      limit: z.number().min(1).max(100).optional().describe('Number of results (default 25, max 100)'),
      start: z.number().min(0).optional().describe('Pagination offset'),
    },
    async (params) => {
      const result = await zoteroClient.searchItems({
        query: params.query,
        itemType: params.itemType,
        tag: params.tag,
        collectionKey: params.collectionKey,
        limit: params.limit,
        start: params.start,
      });

      const items = result.items.map(formatItemSummary);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                totalResults: result.totalResults,
                returned: items.length,
                items,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // get_item - 获取文献详情
  server.tool(
    'get_item',
    'Get detailed metadata of a single item',
    {
      itemKey: z.string().describe('The unique key of the item'),
    },
    async (params) => {
      const item = await zoteroClient.getItem(params.itemKey);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(item.data, null, 2),
          },
        ],
      };
    }
  );
}
