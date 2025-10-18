# CF2 Userscript (TypeScript + React + AntD + Vite)

本项目是一个使用 TypeScript + React + Ant Design 的油猴脚本工程，使用 Vite + vite-plugin-monkey 构建为单文件 `userscript.user.js`，并提供 GM_* API 类型提示与 gRPC（connect-web）示例。

## 功能概览

- TypeScript + React + AntD UI，提供可折叠抽屉面板
- Vite + vite-plugin-monkey 构建为单文件用户脚本，自动注入 Tampermonkey 元信息头
- Biome 格式化 + Lint
- GM_* API 类型提示（通过 `@types/tampermonkey`）
- gRPC（Connect-Web）示例客户端

## 开发

- 开发服务器：
  - 使用 `pnpm dev` 启动开发服务器；在 Tampermonkey 中可创建一个“开发用”用户脚本，内容仅包含元信息和一行 `@require` 指向 dev 输出（端口以实际 dev 输出为准）。vite-plugin-monkey 会为 dev 提供 userscript 头部。

  示例（请根据需要修改 match 与权限）：

  ```javascript
    // ==UserScript==
    // @name         CF2 Userscript (Dev Loader)
    // @namespace    https://example.com/your-namespace
    // @version      0.0.0
    // @description  Dev loader for local development
    // @author       You
    // @match        https://example.com/*
    // @grant        none
  // @require      http://localhost:5173/userscript.user.js
    // ==/UserScript==
    ```

  - 或在页面内直接用 dev server 提供的 JS 地址调试。

- 常用命令：

```sh
pnpm install
pnpm dev
pnpm build
pnpm lint
pnpm format
```

## 构建与发布

- 运行 `pnpm build` 后，会在 `dist/` 下生成 `userscript.user.js`，其中首部包含 Tampermonkey 元信息头。将该文件上传到 GreasyFork 等平台即可。
- 在 `vite.config.ts` 中可编辑 userscript 元信息（`userscript` 配置）。请按需修改 `@name`、`@namespace`、`@match`、`@grant`、`@connect` 等。

## 目录说明

- `src/userscript.tsx`：入口，挂载 React 应用到页面
- `src/ui/`：React 组件与界面
- `src/grpc/`：gRPC 客户端示例

## 注意事项

- 如果需要跨域请求，建议使用 `GM_xmlhttpRequest` 并在元信息中添加 `@grant GM_xmlhttpRequest` 与必要的 `@connect` 域名。
- 如需直接将开发服务器产物注入到 Tampermonkey，可在开发用户脚本中使用 `@require` 指向 dev URL，或将 dev 产物作为 `file://` 方式引入（取决于浏览器策略）。
