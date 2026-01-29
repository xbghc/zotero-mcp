# Translation Server 部署指南

Translation Server 是 Zotero 官方的元数据获取服务，用于通过 DOI、ISBN、PMID、arXiv ID 等标识符自动获取文献信息。

`create_item_by_identifier` 工具依赖此服务。

## 部署方式

### 方式一：从源码部署（推荐）

#### 前置要求

- Node.js 18+
- Git

#### 步骤

1. **克隆仓库**（包含子模块）

```bash
git clone --recurse-submodules https://github.com/zotero/translation-server.git
cd translation-server
```

2. **安装依赖**

```bash
npm install
```

3. **启动服务**

```bash
npm start
```

服务默认运行在 `http://localhost:1969`。

4. **验证部署**

```bash
# 测试 DOI 查询
curl -X POST http://localhost:1969/search \
  -H "Content-Type: text/plain" \
  -d "10.1038/nature12373"
```

成功时返回 JSON 格式的文献元数据。

#### 后台运行

使用 `nohup` 或 `pm2`：

```bash
# 使用 nohup
nohup npm start > translation-server.log 2>&1 &

# 或使用 pm2（推荐）
npm install -g pm2
pm2 start npm --name "translation-server" -- start
pm2 save
```

---

### 方式二：Docker 部署

> 注意：官方 Docker 镜像目前只提供 ARM64 架构。如果你的服务器是 x86_64/AMD64，请使用源码部署。

```bash
# 拉取镜像
docker pull zotero/translation-server

# 运行容器
docker run -d -p 1969:1969 --name translation-server zotero/translation-server
```

验证：

```bash
curl http://localhost:1969/search -d "10.1038/nature12373"
```

---

## API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/search` | POST | 通过标识符获取元数据 |
| `/web` | POST | 解析网页获取元数据 |
| `/export` | POST | 将 Zotero JSON 转为其他格式 |
| `/import` | POST | 将其他格式转为 Zotero JSON |

### /search 端点示例

```bash
# DOI
curl -X POST http://localhost:1969/search \
  -H "Content-Type: text/plain" \
  -d "10.1038/nature12373"

# ISBN
curl -X POST http://localhost:1969/search \
  -H "Content-Type: text/plain" \
  -d "978-0-13-468599-1"

# PMID
curl -X POST http://localhost:1969/search \
  -H "Content-Type: text/plain" \
  -d "PMID:12345678"

# arXiv
curl -X POST http://localhost:1969/search \
  -H "Content-Type: text/plain" \
  -d "arXiv:2301.00001"
```

---

## 配置 Zotero MCP

部署完成后，在 MCP 配置中添加环境变量：

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

如果 Translation Server 部署在其他服务器：

```json
"TRANSLATION_SERVER_URL": "http://your-server-ip:1969"
```

---

## 常见问题

### Q: npm install 失败，网络超时

配置 npm 使用国内镜像：

```bash
npm config set registry https://registry.npmmirror.com
npm install
```

### Q: 服务启动后无法访问

检查端口是否被占用：

```bash
lsof -i :1969
```

检查防火墙设置：

```bash
# Ubuntu/Debian
sudo ufw allow 1969

# CentOS/RHEL
sudo firewall-cmd --add-port=1969/tcp --permanent
sudo firewall-cmd --reload
```

### Q: 查询某些 DOI 失败

部分 DOI 可能需要特定的 translator。确保克隆时使用了 `--recurse-submodules`，以获取完整的 translators 库。

更新 translators：

```bash
cd translation-server
git submodule update --remote modules/translators
```

---

## 参考

- [官方仓库](https://github.com/zotero/translation-server)
- [Zotero Translators](https://github.com/zotero/translators)
