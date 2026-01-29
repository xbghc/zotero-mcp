#!/usr/bin/env node

/**
 * Zotero MCP Server
 * 通过 Zotero Web API 管理文献库
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { ZoteroClient } from './zotero-client.js';
import { TranslationClient } from './translation-client.js';
import { registerSearchTools } from './tools/search.js';
import { registerCollectionTools } from './tools/collections.js';
import { registerTagTools } from './tools/tags.js';
import { registerCreateTools } from './tools/create.js';
import { registerExportTools } from './tools/export.js';
import { registerManageTools } from './tools/manage.js';

// 从环境变量读取配置
const ZOTERO_API_KEY = process.env.ZOTERO_API_KEY;
const ZOTERO_USER_ID = process.env.ZOTERO_USER_ID;
const ZOTERO_GROUP_ID = process.env.ZOTERO_GROUP_ID;
const TRANSLATION_SERVER_URL = process.env.TRANSLATION_SERVER_URL;

// 验证必需的环境变量
if (!ZOTERO_API_KEY) {
  console.error('Error: ZOTERO_API_KEY environment variable is required');
  process.exit(1);
}

if (!ZOTERO_USER_ID) {
  console.error('Error: ZOTERO_USER_ID environment variable is required');
  process.exit(1);
}

// 创建客户端
const zoteroClient = new ZoteroClient({
  apiKey: ZOTERO_API_KEY,
  userId: ZOTERO_USER_ID,
  groupId: ZOTERO_GROUP_ID,
});

const translationClient = new TranslationClient(TRANSLATION_SERVER_URL);

// 创建 MCP Server
const server = new McpServer({
  name: 'zotero-mcp',
  version: '1.0.0',
});

// 注册所有 Tools
registerSearchTools(server, zoteroClient);
registerCollectionTools(server, zoteroClient);
registerTagTools(server, zoteroClient);
registerCreateTools(server, zoteroClient, translationClient);
registerExportTools(server, zoteroClient);
registerManageTools(server, zoteroClient);

// 启动服务器
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('Failed to start Zotero MCP server:', error);
  process.exit(1);
});
