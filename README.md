# CareLink · 安心健康管家

CareLink 是一个 Apple 风格的个人健康与双人关怀 Web 应用。前端发布到 GitHub Pages，账号、共享数据和实时同步由 Supabase 提供。

## 本地运行

```bash
npm install
copy .env.example .env.local
npm run dev
```

不填写 Supabase 环境变量时，应用会使用浏览器 `localStorage` 演示模式。填写后会显示登录页，并要求用户建立或加入家庭空间。

## 配置 Supabase

1. 在 Supabase 创建项目，在 SQL Editor 中完整执行 [`supabase/schema.sql`](supabase/schema.sql)。脚本建立家庭空间、成员、药品、不适记录、RLS 权限和 Realtime 表。
2. 在 Project Settings → API Keys 复制 Project URL 和 **Publishable key**（旧版项目可用 `anon public key`），写入 `.env.local`：

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

3. 在 Authentication → URL Configuration 中加入本地地址和 GitHub Pages 地址，例如 `http://localhost:5173` 与 `https://YOUR_NAME.github.io/YOUR_REPO/`。
4. 第一个用户注册后创建家庭空间，第二个用户注册后输入邀请码。两人进入同一家庭空间后，药品和不适记录会通过 Realtime 互相更新。

## GitHub Pages 部署

仓库已包含 `.github/workflows/deploy.yml`。将代码推送到 `main`，在 GitHub Settings → Pages 选择 **GitHub Actions**，并在仓库 Settings → Secrets and variables → Actions 添加：

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`（或旧版 `VITE_SUPABASE_ANON_KEY`）

工作流会自动构建并发布 `dist`。Publishable/anon key 是前端公开配置，安全边界来自 Supabase RLS；绝不能把 secret/service role key、数据库密码或其他私密凭据放入前端或 GitHub。

## 已实现与边界

- 已实现：健康概览、身体不适记录、药箱增删改查、库存提醒、趋势图、Leaflet 地图、Supabase 邮箱认证、家庭邀请码、共享药品/记录、Realtime 更新、数据导出。
- 当前位置和双人地图仍需在用户明确授权后使用；地图中的演示位置不代表实时的另一位用户位置。
- 尚未实现：邀请链接、位置数据表和撤销共享、路线规划、生产级邮件模板与密码找回流程。这些应在上线双人位置同步前单独设计并审计。
- 健康内容仅用于参考和主动记录，不提供诊断或个性化用药决定。
