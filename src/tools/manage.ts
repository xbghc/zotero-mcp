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
  server.registerTool(
    'update_item',
    {
      title: 'Update Item',
      description: `Update metadata fields of an existing item.
Only provide fields you want to change - other fields remain unchanged.
Common fields: title, date, DOI, url, abstractNote, publicationTitle, volume, issue, pages.`,
      inputSchema: {
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
    },
    async ({ itemKey, ...updates }) => {
      const cleanUpdates: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
          cleanUpdates[key] = value;
        }
      }

      if (Object.keys(cleanUpdates).length === 0) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: 'No fields to update' }, null, 2) }],
        };
      }

      await zoteroClient.updateItem(itemKey, cleanUpdates);

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ success: true, itemKey, updatedFields: Object.keys(cleanUpdates), message: `Item ${itemKey} updated successfully` }, null, 2) }],
      };
    }
  );

  // delete_item - 删除文献
  server.registerTool(
    'delete_item',
    {
      title: 'Delete Item',
      description: `Move an item to trash (does not permanently delete).
The item can be restored from trash in the Zotero client.
To permanently delete, user must empty trash in Zotero.`,
      inputSchema: {
        itemKey: z.string().describe('The key of the item to delete'),
      },
    },
    async ({ itemKey }) => {
      await zoteroClient.deleteItem(itemKey);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ success: true, itemKey, message: `Item ${itemKey} moved to trash` }, null, 2) }],
      };
    }
  );

  // add_tags_to_item - 为文献添加标签
  server.registerTool(
    'add_tags_to_item',
    {
      title: 'Add Tags to Item',
      description: `Add one or more tags to an existing item.
Tags are useful for organizing and filtering items.
Duplicate tags are automatically ignored.`,
      inputSchema: {
        itemKey: z.string().describe('The key of the item'),
        tags: z.array(z.string()).describe('List of tags to add'),
      },
    },
    async ({ itemKey, tags }) => {
      if (tags.length === 0) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: 'No tags provided' }, null, 2) }],
        };
      }

      await zoteroClient.addTagsToItem(itemKey, tags);

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ success: true, itemKey, addedTags: tags, message: `Tags added to item ${itemKey}` }, null, 2) }],
      };
    }
  );

  // add_item_to_collection - 将文献添加到分组
  server.registerTool(
    'add_item_to_collection',
    {
      title: 'Add Item to Collection',
      description: `Add an item to a collection (folder).
An item can belong to multiple collections.
Use list_collections to get available collection keys.`,
      inputSchema: {
        itemKey: z.string().describe('The key of the item'),
        collectionKey: z.string().describe('The key of the collection'),
      },
    },
    async ({ itemKey, collectionKey }) => {
      await zoteroClient.addItemToCollection(itemKey, collectionKey);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ success: true, itemKey, collectionKey, message: `Item ${itemKey} added to collection ${collectionKey}` }, null, 2) }],
      };
    }
  );

  // download_attachment - 下载附件文件
  server.registerTool(
    'download_attachment',
    {
      title: 'Download Attachment',
      description: `Download an attachment file (PDF, etc.) to local cache.
- Only works for stored attachments (imported_file, imported_url)
- Files are cached locally - subsequent calls return cached version
- Use force=true to re-download and update cache
- Returns the local file path for further processing`,
      inputSchema: {
        itemKey: z.string().describe('The key of the attachment item (get from get_item_children)'),
        force: z.boolean().optional().describe('Force re-download even if cached'),
      },
    },
    async ({ itemKey, force }) => {
      try {
        const result = await zoteroClient.downloadAttachment(itemKey, { force });

        return {
          content: [{ type: 'text' as const, text: JSON.stringify({
            success: true, itemKey,
            path: result.path,
            filename: result.filename,
            contentType: result.contentType,
            size: result.size,
            fromCache: result.fromCache,
            message: result.fromCache ? `File retrieved from cache: ${result.path}` : `File downloaded to: ${result.path}`,
          }, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, itemKey, error: error instanceof Error ? error.message : String(error) }, null, 2) }],
        };
      }
    }
  );

  // clear_attachment_cache - 清除附件缓存
  server.registerTool(
    'clear_attachment_cache',
    {
      title: 'Clear Attachment Cache',
      description: `Clear cached attachment files to free disk space.
- Provide itemKey to clear cache for a specific attachment
- Omit itemKey to clear all cached attachments`,
      inputSchema: {
        itemKey: z.string().optional().describe('Clear cache for specific item only'),
      },
    },
    async ({ itemKey }) => {
      await zoteroClient.clearAttachmentCache(itemKey);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ success: true, message: itemKey ? `Cache cleared for item ${itemKey}` : 'All attachment cache cleared' }, null, 2) }],
      };
    }
  );
}
