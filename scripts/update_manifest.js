// scripts/update_manifest.js
// 単一の manifest.json を生成： anki-project/assets/data/manifest.json
const fs = require('fs');
const path = require('path');

const OUT = 'anki-project/assets/data/manifest.json';

// ====== スキャン対象（最小構成：理科） ======
const MARKER_DIR = 'anki-project/assets/data/sci/marker';
const HTML_DIR   = 'anki-project/modules/sci';

// ---- ユーティリティ ----
const readJSON = p => JSON.parse(fs.readFileSync(p, 'utf-8'));
const exists = p => { try { fs.accessSync(p); return true; } catch { return false; } };

function listFiles(dir, exts) {
  if (!exists(dir)) return [];
  const arr = [];
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) arr.push(...listFiles(p, exts));
    else if (exts.includes(path.extname(f).toLowerCase())) arr.push(p);
  }
  return arr;
}

// ---- marker.json -> manifest entry ----
function buildMarkerEntries() {
  const files = listFiles(MARKER_DIR, ['.json']);
  return files.map(fp => {
    let title = path.basename(fp);
    try { title = readJSON(fp).title || title; } catch {}
    const dataPath = '/' + fp.replace(/\\/g, '/'); // 先頭スラッシュ
    const url = `/anki-project/modules/marker.html?data=${dataPath}&title=${encodeURIComponent(title)}`;
    return {
      type: 'marker',
      title,
      data: dataPath,
      path: url,
      tags: ['marker','理科','4年'],
      updated: new Date().toISOString()
    };
  });
}

// ---- HTML(B方式) -> manifest entry ----
function extractTitle(html) {
  const m = html.match(/<title>([^<]+)<\/title>/i);
  return m ? m[1].trim() : null;
}
function buildHtmlEntries() {
  const files = listFiles(HTML_DIR, ['.html', '.htm']);
  return files.map(fp => {
    const html = fs.readFileSync(fp, 'utf-8');
    const title = extractTitle(html) || path.basename(fp);
    const publicPath = '/' + fp.replace(/\\/g, '/'); // 例: /anki-project/modules/sci/body_motion.html
    return {
      type: 'html',
      title,
      path: publicPath,
      tags: ['noimg','理科','4年'],
      updated: new Date().toISOString()
    };
  });
}

// ---- 集約・重複排除（path or data をキーに） ----
function uniqueByKey(items) {
  const seen = new Set();
  return items.filter(x => {
    const key = x.path || x.data || JSON.stringify(x);
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}

// ---- 実行 ----
(function main(){
  const items = uniqueByKey([
    ...buildMarkerEntries(),
    ...buildHtmlEntries()
  ]).sort((a,b) => (Date.parse(b.updated||'')||0) - (Date.parse(a.updated||'')||0));

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(items, null, 2), 'utf-8');
  console.log(`[OK] wrote ${OUT}  items=${items.length}`);
})();
