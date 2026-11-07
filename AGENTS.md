# AGENTS.md —— R-Dir-L10n 语言包仓库（LLM agent 操作指南）

本仓库是 R-Dir 的**语言包独立仓库**：纯 JSON + 校验脚本，零依赖。主仓库构建期以 pnpm
git 依赖引用（`github:cangyunye/R-Dir-L10n#<tag>`），导入路径 `@rdir/l10n/packs/<lang>.json`。

给人类读者的说明见 `README.md`；本文件面向在本仓库工作的 LLM agent。

## 核心机制（改任何东西之前必读）

- **key = 中文原文**。主仓库代码里 `t("删除")` 直接以中文查表；查不到翻译时回退 key 本身
  （即中文），因此**没有 zh 包**，新增文案不被翻译进度阻塞。你翻译时 **key 一律保持中文
  原文不动，只写 value**。
- `errors` 表影响功能正确性（解压密码弹窗、取消判定等按码匹配），**必须随码化同步**，
  不允许滞后；4 个固定码 `CANCELLED` / `CMD_NOT_FOUND` / `NEED_PASSWORD` / `WRONG_PASSWORD`
  缺一即校验失败。`NEED_MASTER_KEY` 是 `CODE: 冒号` 格式且前端按前缀拦截，不入 errors 表。
- **占位符 `{xxx}` 必须原样保留**（`{n}` `{msg}` `{name}` `{ver}` `{path}` `{size}` `{phase}`
  `{label}` `{combo}` 等），顺序可按目标语言语法调整——校验器强制 key 与译文占位符集合一致。
- `keys.txt` 是 `extract-keys.mjs` 的生成物（勿手改）；单测/spec 文件里的 t() 夹具会被
  自动跳过。

## 脚本与校验

```bash
node scripts/extract-keys.mjs       # 扫描主仓库 → keys.txt（自动探测工程根，见下「环境注意」）
node scripts/check-coverage.mjs     # 覆盖+占位符校验，全绿才算完成
node scripts/check-coverage.mjs --loose   # 仅 strings 缺失降级为警告（errors/占位符仍硬失败）
```

校验口径：strings 缺失/疑似失配/占位符不一致 → 失败；errors 缺失（含 CANONICAL_CODES）→
始终失败；errors 未被发现使用 → 仅警告。

## 新增一门语言的完整流程

1. `cp packs/en.json packs/<lang>.json`，改 `meta`（id 用 ISO 码如 `pt`/`ja`，name 用语言
   自名如 `Português`/`日本語`，version 从 `0.1.0` 起，minAppVersion 对齐当前发版）。
2. 翻译全部 strings（以 en.json 为含义基准、中文 key 为最终语义来源）+ errors 4 码。
   **每批 ~100 条跑一次 `check-coverage`**，别攒到最后。
3. 全绿后只提交**自己的 packs/<lang>.json** 并推送；共享文件（scripts/keys.txt/README/
   AGENTS.md）归集成任务。
4. 主仓库接线（集成任务，通常最后一次性做多门语言）：
   - `src/lib/i18n.ts`：`Language` 联合类型加新码，`loadLanguage()` 合法值校验同步；
   - `src/lib/LanguageProvider.tsx`：import 新包 + `BUILTIN_PACKS` 挂载（类型
     `Record<Exclude<Language,"zh">, Pack>` 会强制齐全，少一个编译报错）；
   - `src/components/SettingsDialog.tsx`：语言下拉加 `<option value="<lang>">语言自名</option>`；
   - `pnpm add "github:cangyunye/R-Dir-L10n#<tag>"` bump 依赖（pnpm ≥10 会按 packageManager
     字段自动对齐版本；Node 26+ / Homebrew 安装不再捆绑 corepack，勿加 corepack 前缀）；
   - 复制 `e2e/i18n-en.spec.ts` 为 `<lang>` 冒烟（断言用 `getByRole` + 正则——菜单项可达名
     带快捷键后缀，exact 匹配会漏）；**bump 依赖后先杀掉 1420 端口的旧 dev server 再跑
     e2e**（`reuseExistingServer` 会复用陈旧 server，vite 对语言包 JSON 的解析缓存不失效，
     浏览器会拿到旧包）。

## 翻译规范

- **含义基准用 en.json**，中文 key 是最终语义来源；产品/技术词（Git Diff、SFTP、MD5、zip）
  不译。
- **保留原样的 key**：字体名（`宋体` `黑体` `苹方` `微软雅黑`）、`zip` `tar` `tgz`、`Aa`、
  `127.0.0.1`、快捷键串中的 `Ctrl+…`/`mod+…`/`F11`。
- **片段 key**：一批 key 是句子被 `<b>`/控件切开的片段（如 `重置后所有已保存的`+`密码登录`+
  `服务器将无法自动连接，需要重新输入密码。`），渲染时按代码顺序拼接——必须保证**按序拼接
  后通顺**，不能按片段独立成句。拿不准就打开主仓库对应组件（src/components/…）看上下文。
  已知的其他拼接组：StatusBar 阶段文案（`{phase}失败` `{phase}完成` `{phase}中…`
  `{phase}中：{label}` `停止{phase}`，phase 取自 `复制/移动/上传/下载/压缩/解压` 的译文——
  罗曼语系注意阴阳性一致，可用 `Falha: {phase}` 类句式规避）、DiffDialog 同步确认、
  TextDiffDialog 底部说明、SearchPanel 五段状态行、SettingsDialog 常用工具段与收藏夹入口。
- 中文标点（`——` `：` `、` `「」`）在译文中换目标语言标点。

## 版本与标签

- 直接提交 `main`；每批完成后打 tag（`v0.1.0` 起，新增语言 = minor）。tag 是主仓库 bump
  的锚点——**先本仓库提交打 tag，再主仓库 bump**，顺序不能反。
- 主仓库发版若 key 有增删：先本仓库提交翻译并打 tag，再主仓库 bump。
- 新增 Rust 错误码：同步加进各语言包 `errors`；若是裸码（无 `|` 详情段），同时补进
  `scripts/check-coverage.mjs` 的 `CANONICAL_CODES`。

## 环境注意

- 主仓库路径自动探测按序尝试（也可显式传参）：
  - `../`——本仓库寄放在工程根内（主仓库 .gitignore 已屏蔽本目录）；
  - `../R-Dir/rust-file-manager`——macOS 布局：外层 `R-Dir/` 是历史改名遗留的容器目录，
    工程根在其 `rust-file-manager/` 子目录；
  - `../R-Dir`——Windows 布局：直接以 `R-Dir/` 目录为工程根（兄弟寄放）；
  - `../rust-file-manager`——工程根目录本身命名为 `rust-file-manager`（兄弟寄放）。
- `extract-keys.mjs` 的 `LITERAL_PROP_FILES` 列出「变量传参」key 的定向扫描文件
  （keymap label/group、App paletteItems 等）——主仓库新增变量传参来源时把文件加进去。
- 主仓库 key 措辞变更后：重跑 extract → 覆盖校验会列出「疑似失配」的旧 key，在各语言包里
  同步改名，切勿在 keys.txt 里手改。
