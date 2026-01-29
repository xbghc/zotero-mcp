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
  server.registerTool(
    'export_bibliography',
    {
      title: 'Export Bibliography',
      description: `Export items as formatted bibliography or citation data.
Formats:
- bibtex: BibTeX format for LaTeX
- ris: RIS format for reference managers
- csljson: CSL JSON for citation processors
- bibliography: Formatted citation text (use 'style' parameter)
Common styles for bibliography: apa, chicago-author-date, ieee, vancouver, harvard`,
      inputSchema: {
        itemKeys: z.array(z.string()).min(1).describe('Item keys to export'),
        format: z.enum(['bibtex', 'ris', 'csljson', 'bibliography', 'coins', 'refer', 'tei']).describe('Export format'),
        style: z.string().optional().describe('Citation style for bibliography format (e.g., apa, chicago-author-date, ieee)'),
      },
    },
    async ({ itemKeys, format, style }) => {
      const result = await zoteroClient.exportItems(itemKeys, format, style);
      return {
        content: [{ type: 'text' as const, text: result }],
      };
    }
  );
}
