// scripts/update_manifest.js
// Node 18+。標準モジュールのみ。

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==== 設定（あなたの構成に合わせて必要なら調整） ====
// manifest の場所
const MANIFEST_PATH = path.resolve(__dirname, "..", "assets/data/sci/manifest.json");
// 独立HTML教材（図なし/あり混在）を置くディレクトリ
const SCI_DIR       = path.resolve(__dirname, "..", "modules/sci");
// noimg 用 JSON のディレクトリ
const NOIMG_DIR     = path.resolve(__dirname, "..", "assets/data/sci/noimg");

// manifest の path を生成する際のベース（modules/sci/index.html から見た相対）
const NOIMG_LAUNCHER_REL = "../noimg.html";
// data= の絶対（サイトルートからの）パス
const DATA_PREFIX_ABS = "/anki-project/assets/data/sci/noimg/";

// noimg 既定クエリ（必要に応じて変更）
const DEFAULT_QS = "&voice=true&shuffle=true";

// Actions から渡される Asia/Tokyo 日付（無ければ UTC 日付）
const UPDATED_TODAY =
  process.env.MANIFEST_UPDATED_DATE || new Date().toISOString().slice(0,10);

// ==== ユーティリティ ====
function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}
function writeJSON(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n");
}
function readText(p) {
  return fs.readFileSync(p, "utf-8");
}
function exists(p){ try{ fs.accessSync(p); return true; } catch{ return false; } }

function toRelativeFromSci(absPath) {
  return path.relative(SCI_DIR, absPath).replace(/\\/g, "/"); // 例: "water_state_unit_combined_v3.html"
}
function htmlTitle(html) {
  const m = html.match(/<title>([\s\S]*?)<\/title>/i);
  return m ? m[1].trim() : null;
}
function htmlManifestBlock(html) {
  const m = html.match(/<!--\s*manifest:\s*({[\s\S]*?})\s*-->/i);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

// ==== 収集 ====
// modules/sci/*.html（index.htmlは除外）
function listSciHtmlFiles() {
  if (!exists(SCI_DIR)) return [];
  return fs.readdirSync(SCI_DIR)
    .filter(f => f.endsWith(".html") && f !== "index.html")
    .map(f => path.join(SCI_DIR, f));
}

// assets/data/sci/noimg/*.json
function listNoimgJsonFiles() {
  if (!exists(NOIMG_DIR)) return [];
  return fs.readdirSync(NOIMG_DIR)
    .filter(f => f.endsWith(".json"))
    .map(f => path.join(NOIMG_DIR, f));
}

// ==== manifest 操作 ====
function upsert(manifest, entry) {
  manifest.modules = manifest.modules || [];
  const i = manifest.modules.findIndex(m => m.path === entry.path);
  if (i >= 0) {
    manifest.modules[i] = {
      ...manifest.modules[i],
      ...entry,
      title: entry.title || manifest.modules[i].title
    };
  } else {
    manifest.modules.push(entry);
  }
}

function pruneOrphans(manifest, sciRelSet, noimgPathSet) {
  // 独立HTML：SCI 直下の "xxx.html" で、現存しないものは削除
  manifest.modules = (manifest.modules || []).filter(m => {
    if (typeof m.path !== "string") return true;

    // noimg 経由は別ロジックで判定
    if (m.path.startsWith(NOIMG_LAUNCHER_REL)) {
      return noimgPathSet.has(m.path);
    }

    // "xxx.html"（スラッシュ無し）は SCI 直下独立HTMLと見なす
    const isSciHtml = /^[^/]+\.html$/.test(m.path);
    if (!isSciHtml) return true;
    return sciRelSet.has(m.path);
  });
}

function sortByUpdatedDesc(manifest) {
  manifest.modules.sort((a,b)=> String(b.updated||"").localeCompare(String(a.updated||"")));
}

// ==== main ====
function main() {
  const manifest = exists(MANIFEST_PATH) ? readJSON(MANIFEST_PATH) : { title:"理科教材 一覧", modules: [] };

  // --- 独立HTML ---
  const sciFiles = listSciHtmlFiles();
  const sciRelSet = new Set();
  for (const abs of sciFiles) {
    const rel = toRelativeFromSci(abs); // "foo.html"
    sciRelSet.add(rel);

    const html = readText(abs);
    const meta = htmlManifestBlock(html) || {};
    const fallback = htmlTitle(html);

    const entry = {
      title: meta.title || fallback || path.basename(abs),
      path: rel,
      thumbnail: meta.thumbnail,
      category: meta.category || "理科（小4）",
      tags: Array.isArray(meta.tags) ? meta.tags : [],
      updated: UPDATED_TODAY
    };
    upsert(manifest, entry);
  }

  // --- noimg JSON ---
  const jsonFiles = listNoimgJsonFiles();
  const noimgPathSet = new Set();
  for (const abs of jsonFiles) {
    const base = path.basename(abs);            // e.g. sci4-u2-tenki-kion.json
    const dataAbsUrl = DATA_PREFIX_ABS + base;  // /anki-project/assets/data/sci/noimg/xxx.json
    const json = readJSON(abs);

    // タイトルは JSON.title を優先、無ければファイル名
    const title = json.title || base.replace(/\.json$/,"");

    // path は 例に合わせて noimg.html 起動＋クエリ固定
    const pathForManifest =
      `${NOIMG_LAUNCHER_REL}?data=${encodeURI(dataAbsUrl)}&title=${encodeURIComponent(title)}${DEFAULT_QS}`;

    noimgPathSet.add(pathForManifest);

    const entry = {
      title,
      path: pathForManifest,
      // サムネ等は sidecar（同名 .meta.json）で拡張可
      // 例: sci4-u2-tenki-kion.meta.json に { "thumbnail":"../assets/img/thumb/...", "category":"理科（小4）", "tags":[...] }
      ...readSidecarMeta(abs),
      updated: UPDATED_TODAY
    };
    upsert(manifest, entry);
  }

  // 孤児掃除
  pruneOrphans(manifest, sciRelSet, noimgPathSet);

  // 並べ替え & 保存
  sortByUpdatedDesc(manifest);
  writeJSON(MANIFEST_PATH, manifest);
  console.log("[update_manifest] updated:", MANIFEST_PATH);
}

// 任意: 同名の sidecar メタ（.meta.json）があれば取り込む
function readSidecarMeta(jsonAbsPath) {
  const sidecar = jsonAbsPath.replace(/\.json$/i, ".meta.json");
  if (!exists(sidecar)) return {};
  try {
    const meta = readJSON(sidecar);
    const allowed = {};
    if (typeof meta.thumbnail === "string") allowed.thumbnail = meta.thumbnail;
    if (typeof meta.category === "string")  allowed.category  = meta.category;
    if (Array.isArray(meta.tags))           allowed.tags      = meta.tags;
    return allowed;
  } catch {
    return {};
  }
}

main();
