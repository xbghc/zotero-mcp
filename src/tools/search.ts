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

  // get_recent_items - 获取最近添加的文献
  server.tool(
    'get_recent_items',
    'Get recently added items in the Zotero library',
    {
      limit: z.number().min(1).max(50).optional().describe('Number of items to return (default 10, max 50)'),
    },
    async (params) => {
      const items = await zoteroClient.getRecentItems(params.limit || 10);
      const summaries = items.map(formatItemSummary);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                count: summaries.length,
                items: summaries,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // get_item_children - 获取文献的子项目（附件、笔记）
  server.tool(
    'get_item_children',
    'Get child items (attachments, notes) of a parent item',
    {
      itemKey: z.string().describe('The key of the parent item'),
    },
    async (params) => {
      const children = await zoteroClient.getItemChildren(params.itemKey);

      const result = children.map((child) => ({
        key: child.key,
        itemType: child.data.itemType,
        title: child.data.title || child.data.note?.substring(0, 100) || '(No title)',
        // 附件特有字段
        ...(child.data.itemType === 'attachment' && {
          linkMode: child.data.linkMode,
          contentType: child.data.contentType,
          filename: child.data.filename,
        }),
      }));

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                parentKey: params.itemKey,
                count: result.length,
                children: result,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // get_item_fulltext - 获取文献的全文内容
  server.tool(
    'get_item_fulltext',
    'Get the full-text content of an item (usually an attachment)',
    {
      itemKey: z.string().describe('The key of the item (usually an attachment key)'),
    },
    async (params) => {
      const fulltext = await zoteroClient.getItemFulltext(params.itemKey);

      if (!fulltext) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  success: false,
                  message: 'No full-text content available for this item',
                },
                null,
                2
              ),
            },
          ],
        };
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                success: true,
                itemKey: params.itemKey,
                indexedPages: fulltext.indexedPages,
                totalPages: fulltext.totalPages,
                indexedChars: fulltext.indexedChars,
                totalChars: fulltext.totalChars,
                content: fulltext.content,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
