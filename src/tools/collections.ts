/**
 * 分组相关的 MCP Tools
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ZoteroClient } from '../zotero-client.js';
import type { CollectionSummary, ItemSummary } from '../types.js';

/**
 * 注册分组相关的 Tools
 */
export function registerCollectionTools(server: McpServer, zoteroClient: ZoteroClient): void {
  // list_collections - 列出分组
  server.tool(
    'list_collections',
    'List all collections in the Zotero library',
    {
      parentKey: z.string().optional().describe('Parent collection key to list sub-collections'),
    },
    async (params) => {
      const collections = await zoteroClient.getCollections(params.parentKey);

      const result: CollectionSummary[] = collections.map((c) => ({
        key: c.key,
        name: c.data.name,
        parentCollection: c.data.parentCollection,
      }));

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  // get_collection_items - 获取分组内文献
  server.tool(
    'get_collection_items',
    'Get items in a specific collection',
    {
      collectionKey: z.string().describe('The collection key'),
      limit: z.number().min(1).max(100).optional().describe('Number of results (default 25, max 100)'),
    },
    async (params) => {
      const result = await zoteroClient.searchItems({
        collectionKey: params.collectionKey,
        limit: params.limit,
      });

      const items: ItemSummary[] = result.items.map((item) => {
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
      });

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
}
