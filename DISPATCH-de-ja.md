# 新语言包交接分派：德语（de）/ 日语（ja）

> 本文档写给接手**新增语言包**的 LLM agent。英文（en）已随 v0.38.0 全量上线（815 条），
> 你的任务是把**同一个 key 集合**翻译成 de/ja。两个语言互相独立、可并行，但**只允许改自己
> 的 packs/<lang>.json**；共享文件的接线见「集成任务」。

## 0. 环境与仓库

- 本仓库：`F:\pantheon\Project\R-Dir\R-Dir-L10n`（**独立 git 仓库**，暂寄在主仓库目录内，
  主仓库已 gitignore 它——不要在主仓库提交它）。remote：`git@github.com:cangyunye/R-Dir-L10n.git`，直接提交 `main`。
- 主仓库：`F:\pantheon\Project\R-Dir`（本目录的上一级）。校验脚本会自动探测 `../` 或 `../R-Dir`。
- 零依赖，全部脚本用 `node` 直接跑；`pnpm check` = 重新扫描主仓库生成 keys.txt + 覆盖校验。

## 1. 每个语言 agent 的任务清单

1. `cp packs/en.json packs/de.json`（日语用 ja.json），然后：
   - `meta` 改为：`{ "id": "de", "name": "Deutsch", "version": "0.1.0", "minAppVersion": "0.38.0" }`（ja：id "ja"、name "日本語"）。
   - **keys 一律保持中文原文不动**（系统按中文 key 查表）；只把 value 翻成目标语言。
   - `errors` 4 个码（CANCELLED / CMD_NOT_FOUND / NEED_PASSWORD / WRONG_PASSWORD）必须翻译——影响功能正确性，缺失会硬失败。
   - strings 共 **815 条**，一条都不能少（keys.txt 即全集，勿手改 keys.txt）。
2. 建议分批翻译（每批 ~100 条），每批后跑 `node scripts/check-coverage.mjs` 看
   缺失/占位符错误，避免最后一次性排错。JSON 必须 UTF-8 无 BOM、语法有效。
3. 全绿后：`git add packs/de.json && git commit && git push`。**不要提交别人的包文件、
   不要改 scripts/、keys.txt、README**——这些归集成任务。

## 2. 翻译规范

- **含义基准用 packs/en.json**（同结构英文参考译文），中文原文（key）是最终语义来源，歧义时以中文为准。
- **占位符 `{xxx}` 必须原样保留**（如 `{n}` `{msg}` `{name}` `{ver}` `{path}` `{size}` `{phase}` `{label}` `{combo}` `{cur}` `{keys}` `{err}` `{preview}` `{copy}` `{del}` `{l}` `{r}` `{side}` `{mode}` `{enc}` `{platform}` `{ext}`）——校验器强制 key 与译文的占位符集合一致，丢失即失败。占位符顺序可以按目标语言语法调整（如日语把 `{n}` 后置）。
- **保留原样的 key**（值=原文即可）：`宋体` `黑体` `苹方` `微软雅黑`（字体名）、`zip` `tar` `tgz`、`Aa`、`127.0.0.1`、`.* 正则` 中的 `.*` 部分、`Esc`、快捷键串里的 `Ctrl+…`/`mod+…`/`F11`。
- **语气**：德语用敬称 Sie；日语菜单/按钮用体言止め（名词/动词连用形），消息与说明用です・ます。
- `——`/`：`/`、` 等中文标点在译文中换成目标语言标点；`「」` 换成目标语言引号。
- 文件里的 `Git Diff` `SFTP` `MD5` `zip` 等产品/技术词不译。

### 2.1 片段 key（最难的部分，逐组核对）

一批 key 是**句子被 `<b>`/控件切开的片段**，渲染时按代码顺序拼接。翻译时必须保证
**按序拼接后通顺**，不能按片段独立成句。主要组合（◆=key，→=拼出的完整句）：

- MasterKeyDialog 重置确认：`重置后所有已保存的`+`密码登录`+`服务器将无法自动连接，需要重新输入密码。`／`密钥登录`+`的服务器不受影响（私钥在文件系统）。`／`主机、用户名、分组等配置保留。`
- MasterKeyDialog 说明：`主密钥用于加密保存的服务器密码。未设置主密钥时，记住的密码以明文保存在本机配置中；设置后`+`现有的明文密码会立即自动加密`+`，之后连接需输入主密钥解锁。`／`主密钥`+`只存在内存中、不会写入磁盘`+`；应用不关闭则无需重复输入。`
- 导入主密码框：`导入文件包含加密保存的服务器密码，需输入`+`导出时使用的主密码`+`解析。`+`校验通过后按本机主密钥重新加密合并（同 id 服务器跳过）。`
- 导出主密码框（已设/未设两分支）：`清单中有`+`以明文保存的服务器密码`+`（在主密钥未解锁时保存的）。导出文件会离开本机，`+`需输入主密码把它们加密后再写出；本机清单同时升级为密文。导入时需要同一主密码。`／`。导出文件会离开本机，请设置一个主密码用于加密——`+`导入到其他设备时需要输入同一主密码。本机清单同时升级为密文，之后启动输入此密码解锁。`
- 解压密码框：`「`+文件名+`」是加密压缩包，输入密码继续解压。`
- StatusBar 阶段拼接（phase 取自 `复制/移动/上传/下载/压缩/解压` 的译文）：`{phase}失败` `{phase}完成` `{phase}中…` `{phase}中：{label}` `停止{phase}`——德语如 "Kopieren fehlgeschlagen"、日语如「コピー失敗」可行，注意语序是否需要把 {phase} 译成动名词。
- DiffDialog 同步确认：`以左侧为准：覆盖复制 {copy} 项`／`以右侧为准：覆盖复制 {copy} 项`+`，删除 {del} 项（移入回收站）`（代码还会拼一个字面句号 `。`）。
- TextDiffDialog 底部说明：`行高亮：红 = 左侧（删除），绿 = 右侧（新增）`+`· 悬停行号可编辑/插入/删除，…`（前缀 ` · ` 在代码里拼）。
- SearchPanel 状态行：五段按 ` · ` join——`fd 递归中`/`当前层匹配`、`正则`/`通配符`、`含隐藏`/`跳过隐藏`、`区分大小写`/`不区分大小写`、`尊重 .gitignore`/`共 {n} 项`。
- SettingsDialog 常用工具段：`每个工具可填`+`启动参数`+`，支持占位符`+代码元素+`（当前目录）、`+…+`（文件名）。`+`留空 = 默认：…`+`非终端工具的参数里没写占位符时，…`
- SettingsDialog 收藏夹入口：`入口：右键标签页「收藏此标签页」、空白处右键「收藏夹…」、快捷键`+键位+`（可在「快捷键」分区改键）、或下方按钮。`
- 其余带前后缀拼接：` · +{n} 窗格`、`用 {name} 打开`、`{name}（未找到可执行文件）`、`与「{name}」比较 — 选择另一侧文件`、`标签：{name}`、`文本比较基准：{path}`、`同步·{side}`、`版本 {ver}（Tauri 2 + React）`、`字节（{size}）`、`等 {n} 项`、`（{n} 项）`、`已选 {n} 项，共 {size}`、`已选 {n} 项 · {size}`、`查看「{name}」标签的文件`、`{err}\n\n要永久删除所选 {n} 项吗？此操作不可恢复。`（key 内含换行）。

拿不准就打开主仓库对应组件（src/components/…）看拼接上下文。

## 3. 集成任务（单方执行：先完成的一方等另一方落地后做，或由用户做）

1. 主仓库三处接线（把 de/ja 加进语言枚举）：
   - `src/lib/i18n.ts`：`export type Language = "zh" | "en" | "de" | "ja";`，`loadLanguage()` 的合法值校验同步加 "de"/"ja"。
   - `src/lib/LanguageProvider.tsx`：`import dePack from "@rdir/l10n/packs/de.json"`（ja 同理），`BUILTIN_PACKS = { en: enPack, de: dePack, ja: jaPack }`（类型是 `Record<Exclude<Language,"zh">, Pack>`，少一个会编译报错——这是防呆）。
   - `src/components/SettingsDialog.tsx` 语言下拉加 `<option value="de">Deutsch</option>` / `<option value="ja">日本語</option>`。
2. 依赖 bump：`corepack pnpm add "github:cangyunye/R-Dir-L10n#<tag>"`（tag 见下）。**bump 后必须杀掉 1420 端口的旧 dev server 再跑 e2e**——playwright `reuseExistingServer` 会复用陈旧 server，vite 对语言包 JSON 的解析缓存不失效，浏览器会拿到旧包（症状：fiber 里 language 正确但 t 全部原文）。
3. 冒烟 e2e：复制 `e2e/i18n-en.spec.ts` 为 `i18n-de.spec.ts` / `i18n-ja.spec.ts`，localStorage 值改 `de`/`ja`，断言改目标语言（如设置面板 "Sprache"/「言語」、应用菜单 "Neuer Tab"/「新しいタブ」）。断言用 `getByRole + 正则`（菜单项可达名带快捷键后缀，exact 会漏）。
4. `corepack pnpm exec tsc && corepack pnpm test && corepack pnpm test:e2e` 全绿后按主仓库分支惯例提交合回；发版走 CHANGELOG + tag 流程（`version.test.ts` 的 tag 一致性守卫在打 tag 前会红一条，属设计）。

## 4. 标签策略

- 两个语言包都落地后**打一个 tag**（如 `v0.2.0`，minor = 新增语言），主仓库 bump 到这一个 tag 即可，避免多次 bump。
- 语言包自身的 `meta.version` 每个语言从 `0.1.0` 起独立递增。

## 5. 校验命令

```bash
node scripts/extract-keys.mjs        # 重新扫描主仓库 → keys.txt（勿手改）
node scripts/check-coverage.mjs      # 覆盖+占位符校验，全绿才算完成
node scripts/check-coverage.mjs --loose   # 仅翻译滞后期用（errors/占位符仍硬失败）
```

校验口径：strings 缺失/疑似失配/占位符不一致 → 失败；errors 缺失（含 CANONICAL_CODES 4 码）→ 始终失败；errors 未被发现使用 → 仅警告。
