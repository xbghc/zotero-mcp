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
  server.registerTool(
    'list_collections',
    {
      title: 'List Collections',
      description: `List all collections (folders) in the Zotero library.
Collections help organize items into hierarchical folders.
Use parentKey to list sub-collections of a specific collection.`,
      inputSchema: {
        parentKey: z.string().optional().describe('Parent collection key to list only sub-collections'),
      },
    },
    async ({ parentKey }) => {
      const collections = await zoteroClient.getCollections(parentKey);

      const result: CollectionSummary[] = collections.map((c) => ({
        key: c.key,
        name: c.data.name,
        parentCollection: c.data.parentCollection,
      }));

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  // get_collection_items - 获取分组内文献
  server.registerTool(
    'get_collection_items',
    {
      title: 'Get Collection Items',
      description: `Get all items in a specific collection.
Returns items directly in the collection (not in sub-collections).`,
      inputSchema: {
        collectionKey: z.string().describe('The collection key'),
        limit: z.number().min(1).max(100).optional().describe('Number of results (default 25, max 100)'),
      },
    },
    async ({ collectionKey, limit }) => {
      const result = await zoteroClient.searchItems({ collectionKey, limit });

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
        content: [{ type: 'text' as const, text: JSON.stringify({ totalResults: result.totalResults, returned: items.length, items }, null, 2) }],
      };
    }
  );

  // create_collection - 创建分组
  server.registerTool(
    'create_collection',
    {
      title: 'Create Collection',
      description: `Create a new collection (folder) in the Zotero library.
Collections help organize items into hierarchical folders.
Use parentCollection to create a sub-collection.`,
      inputSchema: {
        name: z.string().describe('Name of the new collection'),
        parentCollection: z.string().optional().describe('Parent collection key to create as sub-collection'),
      },
    },
    async ({ name, parentCollection }) => {
      const collectionKey = await zoteroClient.createCollection(name, parentCollection);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ success: true, collectionKey, name, message: `Collection "${name}" created successfully` }, null, 2) }],
      };
    }
  );

  // update_collection - 更新分组
  server.registerTool(
    'update_collection',
    {
      title: 'Update Collection',
      description: `Update a collection's name or parent.
Set parentCollection to false to move to top level.`,
      inputSchema: {
        collectionKey: z.string().describe('The collection key to update'),
        name: z.string().optional().describe('New name for the collection'),
        parentCollection: z.union([z.string(), z.literal(false)]).optional().describe('New parent collection key, or false to move to top level'),
      },
    },
    async ({ collectionKey, name, parentCollection }) => {
      const updates: { name?: string; parentCollection?: string | false } = {};
      if (name !== undefined) updates.name = name;
      if (parentCollection !== undefined) updates.parentCollection = parentCollection;

      if (Object.keys(updates).length === 0) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: 'No fields to update' }, null, 2) }],
        };
      }

      await zoteroClient.updateCollection(collectionKey, updates);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ success: true, collectionKey, updatedFields: Object.keys(updates), message: `Collection ${collectionKey} updated successfully` }, null, 2) }],
      };
    }
  );

  // delete_collection - 删除分组
  server.registerTool(
    'delete_collection',
    {
      title: 'Delete Collection',
      description: `Delete a collection from the library.
Items in the collection are NOT deleted - they remain in the library.
Sub-collections are also deleted.`,
      inputSchema: {
        collectionKey: z.string().describe('The collection key to delete'),
      },
    },
    async ({ collectionKey }) => {
      await zoteroClient.deleteCollection(collectionKey);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ success: true, collectionKey, message: `Collection ${collectionKey} deleted successfully` }, null, 2) }],
      };
    }
  );
}
