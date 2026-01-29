# @xbghc/zotero-mcp

Zotero MCP Server - 通过 MCP 协议管理 Zotero 文献库。

## 功能

- **查询文献**: 搜索、获取详情、按分组/标签过滤
- **创建文献**: 手动创建或通过 DOI/ISBN/PMID 自动获取元数据
- **导出引用**: 支持 BibTeX、RIS、CSL JSON 等格式

## 安装

```bash
npm install @xbghc/zotero-mcp
```

## 配置

### 获取 Zotero API Key

1. 登录 [zotero.org](https://www.zotero.org)
2. 进入 Settings → Security
3. 记下你的 User ID
4. 点击 "Create new private key" 生成 API Key

### 启动 Translation Server（可选，用于 DOI 自动获取）

```bash
docker run -d -p 1969:1969 zotero/translation-server
```

### Claude Code 配置

在 `~/.claude/settings.json` 中添加：

```json
{
  "mcpServers": {
    "zotero": {
      "command": "npx",
      "args": ["@xbghc/zotero-mcp"],
      "env": {
        "ZOTERO_API_KEY": "your-api-key",
        "ZOTERO_USER_ID": "your-user-id",
        "TRANSLATION_SERVER_URL": "http://localhost:1969"
      }
    }
  }
}
```

## 环境变量

| 变量 | 必需 | 说明 |
|------|------|------|
| `ZOTERO_API_KEY` | 是 | Zotero API 密钥 |
| `ZOTERO_USER_ID` | 是 | 用户 ID |
| `ZOTERO_GROUP_ID` | 否 | 群组 ID（访问群组库时使用） |
| `TRANSLATION_SERVER_URL` | 否 | Translation Server 地址（默认 `http://localhost:1969`） |

## 可用 Tools

### 查询

| Tool | 说明 |
|------|------|
| `search_items` | 搜索文献 |
| `get_item` | 获取文献详情 |
| `list_collections` | 列出分组 |
| `get_collection_items` | 获取分组内文献 |
| `list_tags` | 列出标签 |

### 创建

| Tool | 说明 |
|------|------|
| `create_item` | 手动创建文献 |
| `create_item_by_identifier` | 通过 DOI/ISBN/PMID 创建 |

### 导出

| Tool | 说明 |
|------|------|
| `export_bibliography` | 导出为 BibTeX/RIS 等格式 |

## 开发

```bash
# 安装依赖
npm install

# 构建
npm run build

# 运行
ZOTERO_API_KEY=xxx ZOTERO_USER_ID=xxx npm start
```

## License

MIT
