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
  server.tool(
    'list_tags',
    'List all tags in the Zotero library',
    {
      limit: z.number().min(1).max(100).optional().describe('Number of tags to return (default 50)'),
    },
    async (params) => {
      const tags = await zoteroClient.getTags(params.limit || 50);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(tags, null, 2),
          },
        ],
      };
    }
  );
}
