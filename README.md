# Furtalk Web 控制台

评论系统管理、登录和 OAuth 授权前端。基于 React 19、Vite、TanStack Router 和 TanStack Query 构建的完全静态SPA应用。

## 开发

```bash
pnpm install
pnpm dev
```

Vite 开发服务器运行在 3000 端口，并将 `/api` 代理到 `VITE_API_PROXY_TARGET`（默认 `http://127.0.0.1:8080`）。可通过 `VITE_API_BASE_URL`（默认 `/api/v1`）为浏览器客户端覆盖 API 源地址。

## 生产构建

```bash
pnpm build
```

构建产物为静态浏览器资源及 `dist/index.html`。

## API 配置

- `VITE_API_BASE_URL` — 可选的 API 源地址覆盖；默认使用同源 `/api/v1`。
- `VITE_API_PROXY_TARGET` — 仅用于开发环境的 `/api` 代理目标。

## 生产部署

在任意静态文件服务器上提供 `dist/` 目录，并配置 SPA 回退规则：

- 正常提供已存在的文件；
- 将 `/api/*` 转发到后端，不经过回退；
- 对未知的前端路径返回 `index.html`；
- 绝不将缺失的资源请求重写到 `index.html`。

## 代码检查与格式化

```bash
pnpm lint
pnpm format
pnpm check
```

## 路由

基于文件的路由位于 `src/routes`。在添加、重命名或删除路由文件后，需要重新生成路由树：

```bash
pnpm generate-routes
```

## 测试

```bash
pnpm test
```
