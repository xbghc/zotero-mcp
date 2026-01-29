# @xbghc/zotero-mcp

Zotero MCP Server - 通过 MCP 协议管理 Zotero 文献库。

## 功能

- **查询文献**: 搜索、获取详情、按分组/标签过滤
- **创建文献**: 手动创建或通过 DOI/ISBN/PMID 自动获取元数据
- **管理文献**: 更新文献、删除文献（移到垃圾箱）、添加标签、添加到分组
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

`create_item_by_identifier` 工具需要 Translation Server 支持。

详细部署指南：[Translation Server 部署文档](docs/translation-server-deployment.md)

**快速启动**（从源码）：

```bash
git clone --recurse-submodules https://github.com/zotero/translation-server.git
cd translation-server
npm install
npm start
```

服务运行在 `http://localhost:1969`。

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
| `ZOTERO_MCP_CACHE_DIR` | 否 | 附件缓存目录（默认按系统规范） |

### 附件缓存目录

下载的附件会缓存到本地，默认目录按系统规范：

| 系统 | 默认缓存目录 |
|------|------------|
| Linux | `~/.cache/zotero-mcp` |
| macOS | `~/Library/Caches/zotero-mcp` |
| Windows | `%LOCALAPPDATA%\zotero-mcp\cache` |

可通过 `ZOTERO_MCP_CACHE_DIR` 环境变量自定义。

## 可用 Tools

### 搜索参数说明

`search_items` 支持以下高级参数：

| 参数 | 说明 |
|------|------|
| `qmode` | `titleCreatorYear`（默认）或 `everything`（搜索笔记和全文） |
| `itemType` | 过滤类型，如 `journalArticle`、`book`、`note` |
| `includeChildren` | 设为 `true` 时包含子项目（笔记、附件） |
| `includeTrashed` | 设为 `true` 时包含垃圾箱中的项目 |

示例：搜索所有笔记
```
itemType: "note", includeChildren: true
```

示例：全文搜索
```
query: "machine learning", qmode: "everything"
```

### 查询

| Tool | 说明 |
|------|------|
| `search_items` | 搜索文献（支持 qmode、includeChildren、includeTrashed） |
| `get_item` | 获取文献详情 |
| `get_recent_items` | 获取最近添加的文献 |
| `get_item_children` | 获取附件和笔记 |
| `get_item_fulltext` | 获取全文内容（支持分页） |
| `get_trash_items` | 获取垃圾箱中的文献 |
| `get_saved_searches` | 获取保存的搜索 |
| `list_collections` | 列出分组 |
| `get_collection_items` | 获取分组内文献 |
| `list_tags` | 列出标签 |

### 创建

| Tool | 说明 |
|------|------|
| `create_item` | 手动创建文献 |
| `create_item_by_identifier` | 通过 DOI/ISBN/PMID 创建 |

### 管理

| Tool | 说明 |
|------|------|
| `update_item` | 更新文献元数据 |
| `delete_item` | 删除文献（移到垃圾箱） |
| `add_tags_to_item` | 为文献添加标签 |
| `add_item_to_collection` | 将文献添加到分组 |
| `download_attachment` | 下载附件文件到本地（支持缓存） |
| `clear_attachment_cache` | 清除附件缓存 |

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
