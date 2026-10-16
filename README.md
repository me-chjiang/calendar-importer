# 日程转 ICS 小工具

粘贴一段通知文字（会议邀请、截止日期提醒等），由 DeepSeek 抽取出日程，编辑确认后生成可导入 Outlook 的 `.ics` 文件。纯前端，无后端。

## 功能

- 调用 DeepSeek 从中英文通知里抽取一个或多个事件：标题、地点、起止时间、全天、提醒、重复规则、忙/闲状态
- 也可以跳过 AI，直接手动填写
- 可以给事件加附件：不超过阈值（默认 300 KB，可在设置里改）的完整内嵌进 ics，超过的只在备注里记一下文件名
- 导出：支持 Web Share 的设备弹出系统分享面板，其他情况直接下载 `.ics`
- 提供 Outlook 网页/App 的"新建事件"深链接，用于没法导入 `.ics` 的 Outlook 移动端（只能带标题、时间、地点、正文）
- PWA，可添加到主屏幕

## 使用

```sh
npm install
npm run dev        # 本地开发
npm run build      # 类型检查 + 打包到 dist/
npm run typecheck
```

`npm run build` 会把所有资源内联进 `dist/index.html` 一个文件，不需要服务器，双击就能用 `file://` 打开。

第一次用先点"设置"填上 DeepSeek API Key。Key 只存在浏览器的 `localStorage` 里，由浏览器直接请求 `api.deepseek.com`。

## 目录

- `src/App.tsx` — 主流程：输入 → 编辑 → 生成
- `src/components/` — 事件编辑器、附件选择、设置弹窗
- `src/lib/deepseek.ts` — 调用 DeepSeek 并校验返回的 JSON
- `src/lib/ics.ts` — 生成 ICS
- `src/lib/outlookLink.ts` — Outlook 深链接
- `src/lib/share.ts` — 分享 / 下载
- `src/lib/settings.ts` — 设置读写
