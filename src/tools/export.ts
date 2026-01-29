/**
 * 导出相关的 MCP Tools
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ZoteroClient } from '../zotero-client.js';

/**
 * 注册导出相关的 Tools
 */
export function registerExportTools(server: McpServer, zoteroClient: ZoteroClient): void {
  // export_bibliography - 导出引用
  server.tool(
    'export_bibliography',
    'Export items as bibliography in various formats',
    {
      itemKeys: z.array(z.string()).min(1).describe('Item keys to export'),
      format: z
        .enum(['bibtex', 'ris', 'csljson', 'bibliography', 'coins', 'refer', 'tei'])
        .describe('Export format'),
      style: z
        .string()
        .optional()
        .describe('Citation style for bibliography format (e.g., apa, chicago-author-date)'),
    },
    async (params) => {
      const result = await zoteroClient.exportItems(
        params.itemKeys,
        params.format,
        params.style
      );

      return {
        content: [
          {
            type: 'text' as const,
            text: result,
          },
        ],
      };
    }
  );
}
