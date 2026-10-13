# interview · 面试日程集中管理

把散落在飞书、腾讯会议、Zoom、Teams、邮件里的面试邀请，粘贴进来即可集中管理。

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

- **列表**：搜索（公司/职位/面试官）+ 状态筛选
- **日历**：月视图，今日高亮，点击日程直接编辑
- **看板**：按状态分列，可直接改状态
- **轮次时间线**：按公司聚合各轮面试的推进过程

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
- **存储**：Cloudflare D1（SQLite），首次请求自动建表与迁移
- **测试**：Vitest（解析器与导出逻辑均有单测）

## 本地开发

要求 Node.js ≥ 22。

```bash
npm install
npm run dev        # http://localhost:5173，本地 D1 自动可用
```

其他命令：

```bash
npm test           # 运行单测
npm run typecheck  # 前端 + Worker 双 tsconfig 类型检查
npm run build      # typecheck + 构建
npm run preview    # 构建后本地预览
```

## 部署到 Cloudflare

```bash
npx wrangler login
npx wrangler d1 create interview-db
# 把返回的 database_id 填入 wrangler.jsonc，然后：
npm run deploy
```

数据落在你自己的 Cloudflare 账号里；解析全程为本地规则计算，不依赖、不上传任何第三方服务。

## 目录结构

```
src/
  shared/        # 领域类型 + 会议文本解析器（纯函数，前后端共用）
  worker/        # Cloudflare Worker：/api/interviews CRUD + D1
  client/        # React 应用：视图、表单、导出
tests/           # 解析器 / 导出 单测
```

## Roadmap

- [ ] 导出 / 导入 ICS 日历
- [ ] 面试前提醒
- [ ] 多时区支持（当前固定按北京时间）

## 致谢

- [面了么 mianleme](https://github.com/DanZai233/mianleme) —— 本来已经有人开发出这个工具，奈何无法使用，只能自己 Vibe 了。
