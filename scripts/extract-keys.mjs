#!/usr/bin/env node
// 扫描主仓库 → 生成 keys.txt：
//   strings = 前端 t("...") 字面量（中文原文作 key）
//   errors  = 前端 terr("CODE|...") 字面量 + Rust 源码 "CODE|..." 管道码
// 用法：node scripts/extract-keys.mjs [主仓库根目录]
//   缺省自动探测：../（本仓库寄放在主仓库内）或 ../R-Dir（兄弟目录）。
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
    : [resolve(L10N_ROOT, ".."), resolve(L10N_ROOT, "..", "R-Dir")];
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
// paletteItems 扩展命令同理——变量传参让常规 t() 字面量扫描看不到，定向提取。
// 后续迁移批次（m2 对话框 / m3 面板 / m4 App）若出现新的变量传参来源，把文件加进这里。
const LITERAL_PROP_FILES = ["src/lib/keymap.ts", "src/App.tsx"];
for (const rel of LITERAL_PROP_FILES) {
  const f = join(mainRepo, rel);
  if (existsSync(f)) {
    for (const m of readFileSync(f, "utf8").matchAll(/\b(?:label|group):\s*"([^"]+)"/g)) {
      if (m[1]) stringKeys.add(m[1]);
    }
  }
}

const lines = [
  "# R-Dir i18n keys —— 由 scripts/extract-keys.mjs 自动生成，请勿手改",
  '# strings —— t("...") 的 key（中文原文）',
  ...[...stringKeys].sort(),
  '# errors —— terr("CODE|...") 与 Rust 管道码（裸码扫不到，由 check-coverage 的 CANONICAL_CODES 兜底）',
  ...[...codeKeys].sort(),
];
writeFileSync(OUT_FILE, lines.join("\n") + "\n", "utf8");
console.log(`strings ${stringKeys.size} 条 / errors ${codeKeys.size} 个 → keys.txt`);
