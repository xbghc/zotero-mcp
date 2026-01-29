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
  server.registerTool(
    'search_items',
    {
      title: 'Search Items',
      description: `Search items in the Zotero library.
- Use 'query' for keyword search
- Use 'qmode=everything' to search within notes and full-text content (PDF text)
- Use 'itemType=note' with 'includeChildren=true' to find only notes
- Use 'includeTrashed=true' to include items in trash
- Returns: list of items with key, title, itemType, creators, date`,
      inputSchema: {
        query: z.string().optional().describe('Search keywords'),
        itemType: z.string().optional().describe('Filter by item type: journalArticle, book, note, attachment, etc.'),
        tag: z.string().optional().describe('Filter by tag name'),
        collectionKey: z.string().optional().describe('Filter by collection key'),
        limit: z.number().min(1).max(100).optional().describe('Number of results (default 25, max 100)'),
        start: z.number().min(0).optional().describe('Pagination offset for fetching more results'),
        qmode: z.enum(['titleCreatorYear', 'everything']).optional().describe('Search mode: titleCreatorYear (default, fast) or everything (searches notes and fulltext, slower)'),
        includeChildren: z.boolean().optional().describe('Include child items like notes and attachments in results'),
        includeTrashed: z.boolean().optional().describe('Include items in trash'),
      },
    },
    async ({ query, itemType, tag, collectionKey, limit, start, qmode, includeChildren, includeTrashed }) => {
      const result = await zoteroClient.searchItems({
        query, itemType, tag, collectionKey, limit, start, qmode, includeChildren, includeTrashed,
      });

      const items = result.items.map(formatItemSummary);

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ totalResults: result.totalResults, returned: items.length, items }, null, 2) }],
      };
    }
  );

  // get_item - 获取文献详情
  server.registerTool(
    'get_item',
    {
      title: 'Get Item Details',
      description: `Get complete metadata of a single item by its key.
Returns all fields: title, creators, abstract, DOI, URL, tags, collections, etc.
Use this after search_items to get full details of a specific item.`,
      inputSchema: {
        itemKey: z.string().describe('The unique key of the item (e.g., "ABC12345")'),
      },
    },
    async ({ itemKey }) => {
      const item = await zoteroClient.getItem(itemKey);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(item.data, null, 2) }],
      };
    }
  );

  // get_recent_items - 获取最近添加的文献
  server.registerTool(
    'get_recent_items',
    {
      title: 'Get Recent Items',
      description: `Get the most recently added items in the Zotero library.
Useful for checking what was recently imported or created.
Returns items sorted by dateAdded in descending order.`,
      inputSchema: {
        limit: z.number().min(1).max(50).optional().describe('Number of items to return (default 10, max 50)'),
      },
    },
    async ({ limit }) => {
      const items = await zoteroClient.getRecentItems(limit || 10);
      const summaries = items.map(formatItemSummary);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ count: summaries.length, items: summaries }, null, 2) }],
      };
    }
  );

  // get_item_children - 获取文献的子项目（附件、笔记）
  server.registerTool(
    'get_item_children',
    {
      title: 'Get Item Children',
      description: `Get child items (attachments, notes) of a parent item.
- Attachments include: PDF files, snapshots, linked files
- Notes include: user-created notes attached to the item
Use the returned attachment key with download_attachment to get the file.`,
      inputSchema: {
        itemKey: z.string().describe('The key of the parent item'),
      },
    },
    async ({ itemKey }) => {
      const children = await zoteroClient.getItemChildren(itemKey);

      const result = children.map((child) => ({
        key: child.key,
        itemType: child.data.itemType,
        title: child.data.title || child.data.note?.substring(0, 100) || '(No title)',
        ...(child.data.itemType === 'attachment' && {
          linkMode: child.data.linkMode,
          contentType: child.data.contentType,
          filename: child.data.filename,
        }),
      }));

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ parentKey: itemKey, count: result.length, children: result }, null, 2) }],
      };
    }
  );

  // get_item_fulltext - 获取文献的全文内容（支持分段）
  server.registerTool(
    'get_item_fulltext',
    {
      title: 'Get Item Fulltext',
      description: `Get the full-text content of an item (usually a PDF attachment).
- Supports pagination for large documents using offset and limit
- Use 'hasMore' and 'nextOffset' in response to fetch remaining content
- Returns indexed text extracted from PDF, not the original PDF file
- If you need the actual PDF file, use download_attachment instead`,
      inputSchema: {
        itemKey: z.string().describe('The key of the attachment item (get it from get_item_children)'),
        offset: z.number().min(0).optional().describe('Starting character position (default 0)'),
        limit: z.number().min(1000).max(50000).optional().describe('Number of characters to return (default 10000, max 50000)'),
      },
    },
    async ({ itemKey, offset, limit }) => {
      const fulltext = await zoteroClient.getItemFulltext(itemKey, offset || 0, limit || 10000);

      if (!fulltext) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, message: 'No full-text content available for this item' }, null, 2) }],
        };
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({
          success: true, itemKey,
          offset: fulltext.offset, length: fulltext.length, totalChars: fulltext.totalChars,
          hasMore: fulltext.hasMore, nextOffset: fulltext.nextOffset,
          indexedPages: fulltext.indexedPages, totalPages: fulltext.totalPages,
          content: fulltext.content,
        }, null, 2) }],
      };
    }
  );

  // get_trash_items - 获取垃圾箱中的文献
  server.registerTool(
    'get_trash_items',
    {
      title: 'Get Trash Items',
      description: `Get items that have been moved to trash.
Items in trash can be restored or permanently deleted from Zotero client.`,
      inputSchema: {
        limit: z.number().min(1).max(100).optional().describe('Number of items to return (default 25, max 100)'),
      },
    },
    async ({ limit }) => {
      const items = await zoteroClient.getTrashItems(limit || 25);
      const summaries = items.map(formatItemSummary);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ count: summaries.length, items: summaries }, null, 2) }],
      };
    }
  );

  // get_saved_searches - 获取保存的搜索
  server.registerTool(
    'get_saved_searches',
    {
      title: 'Get Saved Searches',
      description: `Get saved searches (smart collections) defined in the Zotero library.
Returns search names and their filter conditions.`,
      inputSchema: {},
    },
    async () => {
      const searches = await zoteroClient.getSavedSearches();
      const result = searches.map((s) => ({
        key: s.key,
        name: s.data.name,
        conditions: s.data.conditions,
      }));

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ count: result.length, searches: result }, null, 2) }],
      };
    }
  );
}
