/**
 * 创建文献相关的 MCP Tools
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ZoteroClient } from '../zotero-client.js';
import type { TranslationClient } from '../translation-client.js';
import type { ZoteroCreator, ZoteroItemData } from '../types.js';

// 创建者 schema
const creatorSchema = z.object({
  creatorType: z.string().describe('Creator type: author, editor, translator, etc.'),
  firstName: z.string().optional().describe('First name'),
  lastName: z.string().optional().describe('Last name'),
  name: z.string().optional().describe('Full name (for institutional authors)'),
});

/**
 * 注册创建相关的 Tools
 */
export function registerCreateTools(
  server: McpServer,
  zoteroClient: ZoteroClient,
  translationClient: TranslationClient
): void {
  // create_item - 手动创建文献
  server.registerTool(
    'create_item',
    {
      title: 'Create Item',
      description: `Create a new item in the Zotero library with manual metadata entry.
Common item types: journalArticle, book, bookSection, conferencePaper, webpage, thesis.
For journal articles, use create_item_by_identifier with DOI instead - it's faster and more accurate.`,
      inputSchema: {
        itemType: z.string().describe('Item type: journalArticle, book, bookSection, conferencePaper, webpage, thesis, etc.'),
        title: z.string().describe('Title of the item'),
        creators: z.array(creatorSchema).optional().describe('List of creators (authors, editors, etc.)'),
        date: z.string().optional().describe('Publication date (YYYY or YYYY-MM-DD)'),
        DOI: z.string().optional().describe('DOI'),
        url: z.string().optional().describe('URL'),
        abstractNote: z.string().optional().describe('Abstract'),
        publicationTitle: z.string().optional().describe('Journal name or book title'),
        volume: z.string().optional().describe('Volume number'),
        issue: z.string().optional().describe('Issue number'),
        pages: z.string().optional().describe('Page range (e.g., "1-10")'),
        tags: z.array(z.string()).optional().describe('Tags to add'),
        collections: z.array(z.string()).optional().describe('Collection keys to add the item to'),
      },
    },
    async ({ itemType, title, creators, date, DOI, url, abstractNote, publicationTitle, volume, issue, pages, tags, collections }) => {
      const template = await zoteroClient.getItemTemplate(itemType);

      const itemData: ZoteroItemData = {
        ...template,
        title,
        creators: creators as ZoteroCreator[] | undefined,
        date, DOI, url, abstractNote, publicationTitle, volume, issue, pages,
        tags: tags?.map((tag) => ({ tag })),
        collections,
      };

      // 移除 undefined 值
      for (const key of Object.keys(itemData)) {
        if (itemData[key] === undefined) {
          delete itemData[key];
        }
      }

      const itemKey = await zoteroClient.createItem(itemData);

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ success: true, itemKey, message: `Item created successfully with key: ${itemKey}` }, null, 2) }],
      };
    }
  );

  // create_item_by_identifier - 通过标识符创建文献
  server.registerTool(
    'create_item_by_identifier',
    {
      title: 'Create Item by Identifier',
      description: `Create a new item by looking up metadata from DOI, ISBN, PMID, or arXiv ID.
This is the preferred way to add published papers - metadata is fetched automatically.
Requires Translation Server to be running (see README for setup).
Examples: "10.1038/nature12373" (DOI), "978-0-13-468599-1" (ISBN), "PMID:12345678", "arXiv:2301.00001"`,
      inputSchema: {
        identifier: z.string().describe('DOI, ISBN, PMID, or arXiv ID'),
        tags: z.array(z.string()).optional().describe('Tags to add to the created item'),
        collections: z.array(z.string()).optional().describe('Collection keys to add the item to'),
      },
    },
    async ({ identifier, tags, collections }) => {
      const items = await translationClient.search(identifier);

      if (!items || items.length === 0) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: `No metadata found for identifier: ${identifier}` }, null, 2) }],
        };
      }

      const itemData = items[0];

      if (tags && tags.length > 0) {
        const existingTags = itemData.tags || [];
        itemData.tags = [...existingTags, ...tags.map((tag) => ({ tag }))];
      }

      if (collections && collections.length > 0) {
        itemData.collections = collections;
      }

      const itemKey = await zoteroClient.createItem(itemData);

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ success: true, itemKey, title: itemData.title, itemType: itemData.itemType, message: `Item created successfully from ${identifier}` }, null, 2) }],
      };
    }
  );
}
