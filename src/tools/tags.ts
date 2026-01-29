/**
 * 标签相关的 MCP Tools
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ZoteroClient } from '../zotero-client.js';

/**
 * 注册标签相关的 Tools
 */
export function registerTagTools(server: McpServer, zoteroClient: ZoteroClient): void {
  // list_tags - 列出标签
  server.registerTool(
    'list_tags',
    {
      title: 'List Tags',
      description: `List all tags used in the Zotero library.
Tags can be used with search_items to filter items.
Type 0 = user-created tags, Type 1 = automatic tags.`,
      inputSchema: {
        limit: z.number().min(1).max(100).optional().describe('Number of tags to return (default 50)'),
      },
    },
    async ({ limit }) => {
      const tags = await zoteroClient.getTags(limit || 50);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(tags, null, 2) }],
      };
    }
  );
}
