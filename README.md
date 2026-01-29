# @xbghc/zotero-mcp

Zotero MCP Server - 通过 MCP 协议管理 Zotero 文献库。

## 功能

- **查询文献**: 搜索、获取详情、获取全文、按分组/标签过滤
- **创建文献**: 手动创建或通过 DOI/ISBN/PMID 自动获取元数据
- **管理文献**: 更新、删除、添加标签、添加到分组、下载附件
- **导出引用**: 支持 BibTeX、RIS、CSL JSON 等格式

## 快速开始

### 1. 获取 Zotero API Key

1. 登录 [zotero.org](https://www.zotero.org)
2. 进入 Settings → Security
3. 记下你的 **User ID**
4. 点击 "Create new private key" 生成 **API Key**

### 2. 配置 Claude Code

在 `~/.claude/settings.json` 中添加：

```json
{
  "mcpServers": {
    "zotero": {
      "command": "npx",
      "args": ["@xbghc/zotero-mcp"],
      "env": {
        "ZOTERO_API_KEY": "your-api-key",
        "ZOTERO_USER_ID": "your-user-id"
      }
    }
  }
}
```

配置完成后重启 Claude Code 即可使用。

## 可选配置

### Translation Server（DOI 自动获取）

`create_item_by_identifier` 工具需要 Translation Server 支持。

```bash
git clone --recurse-submodules https://github.com/zotero/translation-server.git
cd translation-server
npm install
npm start
```

服务运行在 `http://localhost:1969`，然后在 env 中添加：

```json
"TRANSLATION_SERVER_URL": "http://localhost:1969"
```

## 环境变量

| 变量 | 必需 | 说明 |
|------|------|------|
| `ZOTERO_API_KEY` | 是 | Zotero API 密钥 |
| `ZOTERO_USER_ID` | 是 | 用户 ID |
| `ZOTERO_GROUP_ID` | 否 | 群组 ID（访问群组库时使用） |
| `TRANSLATION_SERVER_URL` | 否 | Translation Server 地址 |
| `ZOTERO_MCP_CACHE_DIR` | 否 | 附件缓存目录 |

## 开发

```bash
npm install
npm run build
npm test
```

## License

MIT
