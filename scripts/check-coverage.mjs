#!/usr/bin/env node
// keys.txt ↔ packs/*.json 覆盖校验：缺失/疑似失配 → 非零退出。
//   strings 缺失（keys.txt 有、包没有）→ 失败（--loose 降级为警告，供翻译滞后期）
//   strings 疑似失配（包里有、keys.txt 没有）→ 失败（多为中文措辞已改，需同步改包）
//   errors  缺失（含 CANONICAL_CODES）→ 始终失败（错误码影响功能正确性）
//   errors  疑似失配（包里有、没被发现使用）→ 仅警告（裸码扫不到，可能误报）
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const L10N_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const KEYS_FILE = join(L10N_ROOT, "keys.txt");
const PACKS_DIR = join(L10N_ROOT, "packs");
const loose = process.argv.includes("--loose");

// 固定必配错误码（plan §4.3 首批码化）。Rust 侧这些是裸码（无 | 详情）扫不到，
// 新增裸码时必须同步补进这里；NEED_MASTER_KEY 是 "CODE: 详情" 冒号格式且前端拦截不展示，不入表。
const CANONICAL_CODES = ["CANCELLED", "CMD_NOT_FOUND", "NEED_PASSWORD", "WRONG_PASSWORD"];

const SEMVER_RE = /^\d+\.\d+\.\d+$/;
const LANG_ID_RE = /^[a-z]{2}(-[A-Za-z]{2,4})?$/;
const CODE_KEY_RE = /^[A-Z][A-Z0-9_]*$/;

function parseKeys(txt) {
  const strings = new Set();
  const codes = new Set();
  let section = null;
  for (const line of txt.split(/\r?\n/)) {
    if (line.startsWith("#")) {
      if (/^#\s*strings/.test(line)) section = strings;
      else if (/^#\s*errors/.test(line)) section = codes;
      continue;
    }
    const key = line.trim().replace(/\\n/g, "\n");
    if (key && section) section.add(key);
  }
  return { strings, codes };
}

function validatePack(pack) {
  const problems = [];
  const meta = pack.meta ?? {};
  if (!LANG_ID_RE.test(meta.id ?? "")) problems.push("meta.id 非法（需形如 en / zh-Hant）");
  if (!meta.name) problems.push("meta.name 缺失");
  if (!SEMVER_RE.test(meta.version ?? "")) problems.push("meta.version 非法（需 x.y.z）");
  if (meta.minAppVersion != null && !SEMVER_RE.test(meta.minAppVersion))
    problems.push("meta.minAppVersion 非法（需 x.y.z）");
  for (const [k, v] of Object.entries(pack.strings ?? {}))
    if (!k || typeof v !== "string") problems.push(`strings 键值非法：${JSON.stringify(k)}`);
  for (const [k, v] of Object.entries(pack.errors ?? {})) {
    if (!CODE_KEY_RE.test(k)) problems.push(`errors 键非 CODE 格式：${k}`);
    if (typeof v !== "string" || !v) problems.push(`errors 值非法：${k}`);
  }
  return problems;
}

if (!existsSync(KEYS_FILE)) {
  console.error("keys.txt 不存在，先运行：node scripts/extract-keys.mjs");
  process.exit(1);
}
const keys = parseKeys(readFileSync(KEYS_FILE, "utf8"));
const packFiles = readdirSync(PACKS_DIR).filter((f) => f.endsWith(".json"));
if (packFiles.length === 0) {
  console.error("packs/ 下没有语言包");
  process.exit(1);
}

const allCodes = new Set([...keys.codes, ...CANONICAL_CODES]);
let failed = false;

for (const f of packFiles) {
  let pack;
  try {
    pack = JSON.parse(readFileSync(join(PACKS_DIR, f), "utf8"));
  } catch (e) {
    console.error(`✗ ${f}：JSON 解析失败 —— ${e.message}`);
    failed = true;
    continue;
  }
  const structural = validatePack(pack);
  if (structural.length) {
    for (const p of structural) console.error(`✗ ${f}：${p}`);
    failed = true;
    continue;
  }

  const strings = pack.strings;
  const errors = pack.errors;
  const missingStrings = [...keys.strings].filter((k) => !(k in strings));
  const staleStrings = Object.keys(strings).filter((k) => !keys.strings.has(k));
  const missingErrors = [...allCodes].filter((c) => !(c in errors));
  const staleErrors = Object.keys(errors).filter((c) => !allCodes.has(c));

  for (const k of missingStrings) console.error(`✗ ${f} strings 缺失：${k}`);
  for (const k of staleStrings)
    console.error(`✗ ${f} strings 疑似失配（keys.txt 已无此 key，多为中文措辞变更）：${k}`);
  for (const c of missingErrors) console.error(`✗ ${f} errors 缺失：${c}`);
  for (const c of staleErrors)
    console.warn(`⚠ ${f} errors 未被发现使用（仅警告，裸码可能扫不到）：${c}`);

  const packFailed =
    (missingStrings.length > 0 && !loose) || staleStrings.length > 0 || missingErrors.length > 0;
  if (packFailed) failed = true;
  console.log(
    `${packFailed ? "✗" : "✓"} ${f}（${pack.meta.id}）：strings ${Object.keys(strings).length}/${keys.strings.size}，errors ${Object.keys(errors).length}/${allCodes.size}`
  );
}

console.log("");
if (failed) {
  console.error("覆盖校验未通过");
  process.exit(1);
}
console.log("覆盖校验通过");
