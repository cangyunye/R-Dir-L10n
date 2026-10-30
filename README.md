# R-Dir-L10n

R-Dir 的国际化语言包独立仓库（实施方案见主仓库 `i18n-language-pack-plan.md`）。

- 纯 JSON 语言包 + 校验脚本，**零依赖**；主仓库构建期以 pnpm 依赖引用，导入路径 `@rdir/l10n/packs/<lang>.json`。
- key 方案：**中文原文作 key**。主仓库查不到翻译时回退 key 本身（即中文原文），因此本仓库**没有 zh 包**；现有中文测试零改动。
- 新增语言：复制 `packs/en.json` 的结构，填 `strings` / `errors`，改 `meta.id`。

## 目录

```
packs/            语言包（en.json 起）
schema/           pack.schema.json —— 包结构定义
scripts/          extract-keys.mjs / check-coverage.mjs
keys.txt          自动生成：主仓库 t()/terr() 扫描结果，勿手改
```

## 语言包格式

```json
{
  "meta": { "id": "en", "name": "English", "version": "0.1.0", "minAppVersion": "0.38.0" },
  "strings": { "删除": "Delete", "共 {n} 项": "{n} items" },
  "errors":  { "NEED_PASSWORD": "Password required" }
}
```

- `strings`：key = 主仓库 `t("...")` 的中文原文；`{n}` / `{msg}` 为占位符，替换参数由调用方传入。
- `errors`：key = 错误码（`CODE` 或 `CODE|中文详情` 中的 `CODE`）；Rust/前端错误串经主仓库 `terr()` 走此表，详情段拼接在译文后。
- `NEED_MASTER_KEY` 例外：它是 `CODE: 详情` 冒号格式，且前端按前缀拦截弹主密码框，不经 `terr()` 展示，**不入 errors 表**。

## 脚本

```bash
pnpm check        # 重新扫描主仓库生成 keys.txt，并校验所有语言包覆盖（默认严格：strings 缺失也算失败）
pnpm check:loose  # strings 缺失降级为警告（翻译滞后期用；errors 缺失始终硬失败）
pnpm extract      # 只重新生成 keys.txt
```

- 主仓库路径自动探测：`../`（本仓库寄放在主仓库内）或 `../R-Dir`（兄弟目录）；也可显式传 `node scripts/extract-keys.mjs <主仓库根目录>`。
- 校验口径：
  - strings 缺失（keys.txt 有、包没有）→ 失败，`--loose` 降为警告
  - strings 疑似失配（包里有、keys.txt 没有，多半是中文措辞改了）→ 失败
  - errors 缺失（含固定必配码，见 `scripts/check-coverage.mjs` 的 `CANONICAL_CODES`）→ 始终失败
  - errors 疑似失配（包里有、没被发现使用）→ 仅警告（裸码扫不到，可能误报）

## 维护约定

- 纯数据仓库，单人维护：直接提交 `main`，每批翻译完成打 tag（v0.1.0 起递增）。
- 主仓库发版若 key 有增删：**先**在本仓库提交翻译并打 tag，**再**在主仓库 bump 依赖 tag，顺序不能反。
- 新增 Rust 错误码：同步加进各语言包 `errors`；若是裸码（无 `|` 详情段），同时补进 `CANONICAL_CODES`，否则脚本扫不到。
- errors 表与 strings 不同：它影响功能正确性（密码弹窗、取消判定等按码匹配），必须随码化同步到位，不允许滞后。
