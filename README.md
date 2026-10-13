# 面面 · 面试日程集中管理

「面面」（英文名 interview）——把散落在飞书、腾讯会议、Zoom、Teams、邮件里的面试邀请，粘贴进来即可集中管理。

## 为什么做

最近在找工作，面试不算多，但不同公司用的是不同平台：有的发飞书邀请，有的用腾讯会议，有的直接一封邮件。日程散落在各个 App 里，想看「我这周到底有哪些面」得来回翻。

参考了 [面了么（DanZai233/mianleme）](https://github.com/DanZai233/mianleme)，思路很好，不过其「智能识别」依赖自建服务端 AI 服务（需要自己配模型和 API Key），开箱不可用。干脆用 AI 自己写一个：**纯规则解析、零 AI 依赖、零配置**，反正也花不了多少功夫。

## 功能

### 粘贴即解析

把会议邀请 / HR 邮件正文原样粘贴，自动提取：

| 字段 | 说明 |
| --- | --- |
| 公司 | 品牌名优先（如 `智驾新程（上海）智能科技有限公司` → `智驾新程`） |
| 职位 | 结构化识别（`智驾应用软件开发工程师` → `智驾应用软件开发`） |
| 轮次 | 识别后归一化（`初面` → `一面`），无轮次默认 `一面` |
| 时间 | 中英文格式均可，统一按北京时间（GMT+8）存储 |
| 平台 | 飞书 / 腾讯会议 / Zoom / Teams / Google Meet |
| 其他 | 会议号、密码、入会链接、组织者（`XX邀请你加入…`）、注意事项（写入备注） |

解析是启发式的，结果回填表单供人工确认，并给出识别度与警告。

### 四种视图

- **列表**：搜索（公司/职位/面试官）+ 状态筛选 + 时间正序/倒序
- **日历**：月视图，今日高亮，点击日程直接编辑
- **看板**：按状态分列，可直接改状态
- **轮次时间线**：按公司聚合各轮面试的推进过程，时间正序/倒序可切换

### 状态流转

`待安排` / `待面试` / `通过` / `已取消` / `已拒绝` / `已挂`

### 导出日程给 HR

一键导出**本月、今天起**的已占用时段，自动屏蔽公司与面试细节（职位、轮次、面试官、备注等一概不含），复制后即可发给 HR 排期：

```
2026年10月 日程（今天起的已占用时段，共 2 项）

10月14日（周三）  20:00-21:00  已占用
10月15日（周四）  11:00-11:45  已占用
```

## 技术栈

- **前端**：React + TypeScript + Vite
- **后端**：Cloudflare Workers（单 Worker 同时托管静态资源与 API）
- **存储**：Cloudflare D1（SQLite），`migrations/` 目录管理 schema
- **鉴权**：邮箱注册/登录，PBKDF2-SHA256（WebCrypto）存密码，D1 session + HttpOnly cookie，零运行时依赖
- **测试**：Vitest（解析器、导出与鉴权逻辑均有单测）

## 隐私与数据归属

- **数据只落在你自己的 Cloudflare 账号里**：日程、会议号、密码、粘贴的邀请原文（`raw_text`）全部存在你自己的 D1 中，本项目没有、也不会上报任何第三方服务；解析全程是本地规则计算。
- **所有接口要求登录**：`/api/interviews*` 没有 session 一律 401，每条数据按账号（`user_id`）隔离，互相不可见。
- **密码不以明文存储**：PBKDF2-SHA256 加盐哈希（10 万次迭代），登录失败不区分「邮箱不存在」和「密码错误」。
- **会话**：cookie 为 `HttpOnly + Secure + SameSite=Lax`，服务端 30 天过期，登出即删。
- **注册/登录有每 IP 限流**（注册 5 次/小时、登录 10 次/小时），限流计数存在内存里，Worker 重启即清零——挡脚本够用，不是安全边界。
- **但也要说清楚**：谁跑这个实例，谁就握着那个数据库，D1 是可以直接查的。所以别用别人的实例——自己部署一份，十五分钟，步骤在下面。

## 本地开发

要求 Node.js ≥ 22。

```bash
npm install
npm run migrate:local   # 首次运行前建本地表
npm run dev             # http://localhost:5173，本地 D1 自动可用
```

其他命令：

```bash
npm test           # 运行单测
npm run typecheck  # 前端 + Worker 双 tsconfig 类型检查
npm run build      # typecheck + 构建
npm run preview    # 构建后本地预览
npm run smoke      # 对线上跑 API 冒烟（登录/CRUD/登出，目标取自 routes，SMOKE_BASE_URL 可覆盖）
```

`npm run deploy` 自动带两道防线：`predeploy` 校验 `wrangler.jsonc`（database_id 占位符直接拒绝部署），`postdeploy` 部署完自动跑一遍冒烟。

## 自己部署到 Cloudflare（约 15 分钟）

前置条件：一个 Cloudflare 账号和 Node.js ≥ 22。

### 1. 安装并登录

```bash
npm install
npx wrangler login
```

### 2. 建 D1 数据库

```bash
npx wrangler d1 create interview-db
```

把返回的 `database_id` 填进 `wrangler.jsonc`。

### 3. 域名与路由（建议）

`*.workers.dev` 在中国大陆可能被 DNS 污染，无法直连。如果你的域名 DNS 托管在 Cloudflare，推荐把 API 挂到同域路由——`wrangler.jsonc` 里的 `routes` 默认就是这种形式：

```jsonc
"routes": [{ "pattern": "shaozk.xyz/api/*", "zone_name": "shaozk.xyz" }]
```

把 `shaozk.xyz` 换成你的域名。这样 `/api/*` 请求由 Worker 接管、与前端同源（无需 CORS、无第三方 cookie），其余路径照常回源，不影响同域的其他站点。没有 Cloudflare 托管的域名的话，可以先删掉 `routes`，用 `xxx.workers.dev` 跑着（大陆可能无法直连）。

### 4. 建表并部署

```bash
npm run deploy    # 先构建，再对远端 D1 apply migration，最后发布 Worker
```

部署完会给你一个 `https://interview.<你的子域>.workers.dev`（或你绑定的域名）。

### 5. 注册第一个账号

打开部署地址，切换到「注册」，用邮箱和密码注册即可。注册是开放的，但每条数据按账号隔离，别人注册也看不到你的任何东西；不希望陌生人注册的话，定期 `npx wrangler d1 execute interview-db --remote --command "SELECT email FROM users"` 看一眼即可。

**更新部署一律走 `npm run deploy`**——「先 migration 再发布」这个顺序是 schema 和代码不脱节的全部保证。

### 6. （可选）前端托管到 GitHub Pages

前端静态托管到 GitHub Pages，Worker 只当 API 用（配合第 3 步的同域 route，前后端同源、所有浏览器都能登录）：

1. 按第 3 步把 `wrangler.jsonc` 的 `routes` 配成 `<你的域名>/api/*` 并 `npm run deploy`
2. 仓库 **Settings → Pages → Build and deployment → Source** 选 **GitHub Actions**
3. push 到 `main`（或在 Actions 里手动触发 Deploy Pages）即可，之后每次 push 自动更新

Pages 构建不设 `VITE_API_BASE_URL`，前端直接请求同域的 `/api/*`，由 Cloudflare route 转给 Worker——不要配跨站的 Worker 地址，`*.workers.dev` 在大陆连不通，跨站还会引入第三方 cookie 限制（Safari 无法登录）。

## 目录结构

```
migrations/      # D1 schema 迁移（wrangler d1 migrations apply 管理）
src/
  shared/        # 领域类型 + 会议文本解析器（纯函数，前后端共用）
  worker/        # Cloudflare Worker：鉴权 + /api/interviews CRUD + D1
  client/        # React 应用：登录、视图、表单、导出
tests/           # 解析器 / 导出 / 鉴权 单测
```

## Roadmap

- [ ] 导出 / 导入 ICS 日历
- [ ] 面试前提醒
- [ ] 多时区支持（当前固定按北京时间）
- [ ] 注册接 Cloudflare Turnstile 人机验证（现在只有每 IP 限流）

## 致谢

- [面了么 mianleme](https://github.com/DanZai233/mianleme) —— 本来已经有人开发出这个工具，奈何无法使用，只能自己 Vibe 了。
