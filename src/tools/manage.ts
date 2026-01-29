/**
 * 文献管理相关的 MCP Tools（更新、删除、标签、分组）
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ZoteroClient } from '../zotero-client.js';

/**
 * 注册管理相关的 Tools
 */
export function registerManageTools(
  server: McpServer,
  zoteroClient: ZoteroClient
): void {
  // update_item - 更新文献
  server.tool(
    'update_item',
    'Update an existing item in the Zotero library',
    {
      itemKey: z.string().describe('The key of the item to update'),
      title: z.string().optional().describe('New title'),
      date: z.string().optional().describe('New publication date'),
      DOI: z.string().optional().describe('New DOI'),
      url: z.string().optional().describe('New URL'),
      abstractNote: z.string().optional().describe('New abstract'),
      publicationTitle: z.string().optional().describe('New journal or publication name'),
      volume: z.string().optional().describe('New volume number'),
      issue: z.string().optional().describe('New issue number'),
      pages: z.string().optional().describe('New page range'),
    },
    async (params) => {
      const { itemKey, ...updates } = params;

      // 移除 undefined 值
      const cleanUpdates: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
          cleanUpdates[key] = value;
        }
      }

      if (Object.keys(cleanUpdates).length === 0) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  success: false,
                  error: 'No fields to update',
                },
                null,
                2
              ),
            },
          ],
        };
      }

      await zoteroClient.updateItem(itemKey, cleanUpdates);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                success: true,
                itemKey,
                updatedFields: Object.keys(cleanUpdates),
                message: `Item ${itemKey} updated successfully`,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // delete_item - 删除文献
  server.tool(
    'delete_item',
    'Delete an item from the Zotero library (moves to trash)',
    {
      itemKey: z.string().describe('The key of the item to delete'),
    },
    async (params) => {
      await zoteroClient.deleteItem(params.itemKey);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                success: true,
                itemKey: params.itemKey,
                message: `Item ${params.itemKey} moved to trash`,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // add_tags_to_item - 为文献添加标签
  server.tool(
    'add_tags_to_item',
    'Add tags to an existing item in the Zotero library',
    {
      itemKey: z.string().describe('The key of the item'),
      tags: z.array(z.string()).describe('Tags to add'),
    },
    async (params) => {
      if (params.tags.length === 0) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  success: false,
                  error: 'No tags provided',
                },
                null,
                2
              ),
            },
          ],
        };
      }

      await zoteroClient.addTagsToItem(params.itemKey, params.tags);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                success: true,
                itemKey: params.itemKey,
                addedTags: params.tags,
                message: `Tags added to item ${params.itemKey}`,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // add_item_to_collection - 将文献添加到分组
  server.tool(
    'add_item_to_collection',
    'Add an item to a collection in the Zotero library',
    {
      itemKey: z.string().describe('The key of the item'),
      collectionKey: z.string().describe('The key of the collection'),
    },
    async (params) => {
      await zoteroClient.addItemToCollection(params.itemKey, params.collectionKey);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                success: true,
                itemKey: params.itemKey,
                collectionKey: params.collectionKey,
                message: `Item ${params.itemKey} added to collection ${params.collectionKey}`,
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
