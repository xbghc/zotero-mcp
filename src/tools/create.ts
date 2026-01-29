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
  server.tool(
    'create_item',
    'Create a new item in the Zotero library manually',
    {
      itemType: z.string().describe('Item type (e.g., journalArticle, book, webpage)'),
      title: z.string().describe('Title of the item'),
      creators: z.array(creatorSchema).optional().describe('List of creators'),
      date: z.string().optional().describe('Publication date'),
      DOI: z.string().optional().describe('DOI'),
      url: z.string().optional().describe('URL'),
      abstractNote: z.string().optional().describe('Abstract'),
      publicationTitle: z.string().optional().describe('Journal or publication name'),
      volume: z.string().optional().describe('Volume number'),
      issue: z.string().optional().describe('Issue number'),
      pages: z.string().optional().describe('Page range'),
      tags: z.array(z.string()).optional().describe('Tags to add'),
      collections: z.array(z.string()).optional().describe('Collection keys to add to'),
    },
    async (params) => {
      // 获取项目模板
      const template = await zoteroClient.getItemTemplate(params.itemType);

      // 填充数据
      const itemData: ZoteroItemData = {
        ...template,
        title: params.title,
        creators: params.creators as ZoteroCreator[] | undefined,
        date: params.date,
        DOI: params.DOI,
        url: params.url,
        abstractNote: params.abstractNote,
        publicationTitle: params.publicationTitle,
        volume: params.volume,
        issue: params.issue,
        pages: params.pages,
        tags: params.tags?.map((tag) => ({ tag })),
        collections: params.collections,
      };

      // 移除 undefined 值
      for (const key of Object.keys(itemData)) {
        if (itemData[key] === undefined) {
          delete itemData[key];
        }
      }

      const itemKey = await zoteroClient.createItem(itemData);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                success: true,
                itemKey,
                message: `Item created successfully with key: ${itemKey}`,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // create_item_by_identifier - 通过标识符创建文献
  server.tool(
    'create_item_by_identifier',
    'Create a new item by DOI, ISBN, PMID, or arXiv ID (requires Translation Server)',
    {
      identifier: z.string().describe('DOI, ISBN, PMID, or arXiv ID'),
      tags: z.array(z.string()).optional().describe('Additional tags to add'),
      collections: z.array(z.string()).optional().describe('Collection keys to add to'),
    },
    async (params) => {
      // 通过 Translation Server 获取元数据
      const items = await translationClient.search(params.identifier);

      if (!items || items.length === 0) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  success: false,
                  error: `No metadata found for identifier: ${params.identifier}`,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      // 使用第一个结果
      const itemData = items[0];

      // 添加额外的标签
      if (params.tags && params.tags.length > 0) {
        const existingTags = itemData.tags || [];
        itemData.tags = [
          ...existingTags,
          ...params.tags.map((tag) => ({ tag })),
        ];
      }

      // 添加到分组
      if (params.collections && params.collections.length > 0) {
        itemData.collections = params.collections;
      }

      const itemKey = await zoteroClient.createItem(itemData);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                success: true,
                itemKey,
                title: itemData.title,
                itemType: itemData.itemType,
                message: `Item created successfully from ${params.identifier}`,
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
