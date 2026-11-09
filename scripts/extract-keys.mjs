#!/usr/bin/env node
// 扫描主仓库 → 生成 keys.txt：
//   strings = 前端 t("...") 字面量（中文原文作 key）
//   errors  = 前端 terr("CODE|...") 字面量 + Rust 源码 "CODE|..." 管道码
// 用法：node scripts/extract-keys.mjs [主仓库根目录]
//   缺省自动探测（按序）：../（L10n 寄放在工程根内）、../R-Dir/rust-file-manager
//   （macOS：外层 R-Dir/ 是历史改名遗留的容器目录，工程根在其子目录）、
//   ../R-Dir（Windows：R-Dir/ 即工程根）、../rust-file-manager。
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const L10N_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_FILE = join(L10N_ROOT, "keys.txt");
const CODE_RE = /^[A-Z][A-Z0-9_]*$/;

// t/terr 紧跟字符串字面量；(?<![\w$.]) 排除 split( / insert( 等方法调用与标识符粘连。
// 反引号字面量内含 ${ 的是插值不是 key，跳过。
// 捕获组：1 = 函数名，2 = 双引号串，3 = 单引号串，4 = 反引号串（(?: 非捕获，组号连续）。
const CALL_RE =
  /(?<![\w$.])(t|terr)\(\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|`([^`\\]*(?:\\.[^`\\]*)*)`)/g;
// Rust 侧只认 "CODE|详情" 管道码；裸码（如未来的 "CANCELLED"）扫不到，
// 由 check-coverage.mjs 的 CANONICAL_CODES 清单兜底。
const RUST_PIPE_RE = /"([A-Z][A-Z0-9_]+)\|/g;

function findMainRepo() {
  const arg = process.argv[2];
  const candidates = arg
    ? [resolve(arg)]
    : [
        resolve(L10N_ROOT, ".."), // L10n 寄放在工程根内
        resolve(L10N_ROOT, "..", "R-Dir", "rust-file-manager"), // macOS：外层 R-Dir/ 是历史改名容器，工程根在其子目录
        resolve(L10N_ROOT, "..", "R-Dir"), // Windows：R-Dir/ 即工程根
        resolve(L10N_ROOT, "..", "rust-file-manager"), // 工程根目录本身名为 rust-file-manager
      ];
  for (const dir of candidates) {
    if (existsSync(join(dir, "package.json")) && existsSync(join(dir, "src"))) return dir;
  }
  console.error(
    "找不到主仓库根目录（需同时含 package.json 与 src/）。" +
      "可显式传入：node scripts/extract-keys.mjs <主仓库根目录>"
  );
  process.exit(1);
}

function walk(dir, exts, out = []) {
  for (const name of readdirSync(dir).sort()) {
    if (name === "node_modules" || name === "dist" || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, exts, out);
    else if (exts.some((e) => name.endsWith(e))) out.push(p);
  }
  return out;
}

function unescapeLit(s) {
  return s.replace(/\\(.)/g, (_, c) => ({ n: "\n", t: "\t" }[c] ?? c));
}

const mainRepo = findMainRepo();
const stringKeys = new Set();
const codeKeys = new Set();

for (const file of walk(join(mainRepo, "src"), [".ts", ".tsx"])) {
  // 测试文件里的 t()/terr() 是用例夹具，不是 UI 文案源
  if (/[.](test|spec|stories)\.[cm]?[jt]sx?$/.test(file)) continue;
  const src = readFileSync(file, "utf8");
  for (const m of src.matchAll(CALL_RE)) {
    const raw = m[2] ?? m[3] ?? m[4];
    if (raw == null) continue;
    const key = unescapeLit(raw);
    if (!key || key.includes("${")) continue;
    if (m[1] === "terr") {
      const code = key.split("|")[0].trim();
      if (CODE_RE.test(code)) codeKeys.add(code);
      else console.warn(`[warn] terr() 字面量不是 "CODE|详情" 格式：${key.slice(0, 50)}`);
    } else {
      stringKeys.add(key);
    }
  }
}

const rustSrc = join(mainRepo, "src-tauri", "src");
if (existsSync(rustSrc)) {
  for (const file of walk(rustSrc, [".rs"])) {
    for (const m of readFileSync(file, "utf8").matchAll(RUST_PIPE_RE)) codeKeys.add(m[1]);
  }
} else {
  console.warn("[warn] 没找到 src-tauri/src，跳过 Rust 管道码扫描");
}

// keymap.ts 的 label/group 存中文原文、消费端展示时过 t(a.label)；App.tsx 的
// paletteItems、DiffDialog/TextDiffDialog 的 LEVELS/EOL_LABEL 等映射表同理——
// 变量传参让常规 t() 字面量扫描看不到，定向提取（label/group/hint 属性字面量）。
// 后续迁移批次（m3 面板 / m4 App）若出现新的变量传参来源，把文件加进这里。
const LITERAL_PROP_FILES = [
  "src/lib/keymap.ts",
  "src/lib/persist.ts",
  "src/App.tsx",
  "src/components/DiffDialog.tsx",
  "src/components/TextDiffDialog.tsx",
  "src/components/SettingsDialog.tsx",
  "src/components/Sidebar.tsx",
  "src/components/StatusBar.tsx",
  "src/components/FileList.tsx",
  "src/lib/themeEditor.ts",
];
for (const rel of LITERAL_PROP_FILES) {
  const f = join(mainRepo, rel);
  if (existsSync(f)) {
    for (const m of readFileSync(f, "utf8").matchAll(/\b(?:label|group|hint):\s*"([^"]+)"/g)) {
      if (m[1]) stringKeys.add(m[1]);
    }
  }
}

// themeEditor.ts 的 validateDraft 返回「错误文案 key」（界面层 t(invalid) 查表）——
// 变量传参常规扫描看不到，定向提取 return "..." 字面量（仅限该文件）。
const themeEditorTs = join(mainRepo, "src", "lib", "themeEditor.ts");
if (existsSync(themeEditorTs)) {
  for (const m of readFileSync(themeEditorTs, "utf8").matchAll(/return\s+"([^"]+)"/g)) {
    if (m[1]) stringKeys.add(unescapeLit(m[1]));
  }
}

// ipc.ts 的 web 桥错误以 throw `CODE|中文详情` 模板串产出（terr 按码查 errors 表）——
// Rust 管道码扫描只覆盖 .rs，这里定向补扫（仅限该文件）。
const ipcTs = join(mainRepo, "src", "lib", "ipc.ts");
if (existsSync(ipcTs)) {
  for (const m of readFileSync(ipcTs, "utf8").matchAll(/throw\s+`([A-Z][A-Z0-9_]+)\|/g)) {
    if (m[1]) codeKeys.add(m[1]);
  }
}

// plugins.rs 的内置插件 name/description 以 Rust 字面量登记，前端 t(p.name)/t(p.description)
// 动态查表（设置 → 插件面板）——常规 t() 扫描看不到，定向提取（仅限该文件，避免
// 其他 .rs 的 name:/description: 字段误报）。Rust 转义（如 \\host）经 unescapeLit 还原为
// 运行时串，与前端拿到的 key 逐字一致。
const pluginsRs = join(mainRepo, "src-tauri", "src", "plugins.rs");
if (existsSync(pluginsRs)) {
  for (const m of readFileSync(pluginsRs, "utf8").matchAll(/\b(?:name|description):\s*"([^"]+)"/g)) {
    if (m[1]) stringKeys.add(unescapeLit(m[1]));
  }
}

const lines = [
  "# R-Dir i18n keys —— 由 scripts/extract-keys.mjs 自动生成，请勿手改",
  '# strings —— t("...") 的 key（中文原文）',
  // key 内的换行转义为字面 \n（keys.txt 是行格式；check-coverage 读取时还原）
  ...[...stringKeys].sort().map((k) => k.replace(/\n/g, "\\n")),
  '# errors —— terr("CODE|...") 与 Rust 管道码（裸码扫不到，由 check-coverage 的 CANONICAL_CODES 兜底）',
  ...[...codeKeys].sort(),
];
writeFileSync(OUT_FILE, lines.join("\n") + "\n", "utf8");
console.log(`strings ${stringKeys.size} 条 / errors ${codeKeys.size} 个 → keys.txt`);
