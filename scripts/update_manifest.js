// scripts/update_manifest.js
// 単一の manifest.json を生成: anki-project/assets/data/manifest.json
const fs = require('fs');
const path = require('path');

const OUT = 'anki-project/assets/data/manifest.json';

// === 科目設定（必要ならここに追加） ===
// subject.key はディレクトリ名、tags は既定タグ
const SUBJECTS = [
  { key: 'sci',  titleTag: '理科',  gradeTag: '4年' },
  { key: 'geo',  titleTag: '地理',  gradeTag: '4年' },
  { key: 'jpn',  titleTag: '国語',  gradeTag: '4年' },
  { key: 'math', titleTag: '算数',  gradeTag: '4年' }
];

// 共通utility
const exists = p => { try { fs.accessSync(p); return true; } catch { return false; } };
const readJSON = p => JSON.parse(fs.readFileSync(p, 'utf-8'));
function listFiles(dir, exts) {
  if (!exists(dir)) return [];
  const out = [];
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) out.push(...listFiles(p, exts));
    else if (exts.includes(path.extname(f).toLowerCase())) out.push(p);
  }
  return out;
}
function extractTitle(html) {
  const m = html.match(/<title>([^<]+)<\/title>/i);
  return m ? m[1].trim() : null;
}

function buildMarkerEntriesForSubject(subj) {
  const dir = `anki-project/assets/data/${subj.key}/marker`;
  const files = listFiles(dir, ['.json']);
  return files.map(fp => {
    let title = path.basename(fp);
    try { title = readJSON(fp).title || title; } catch {}
    const dataPath = '/' + fp.replace(/\\/g, '/'); // /anki-project/… に対して先頭/
    const url = `/anki-project/modules/marker.html?data=${dataPath}&title=${encodeURIComponent(title)}`;
    return {
      type: 'marker',
      title,
      data: dataPath,
      path: url,
      tags: ['marker', subj.titleTag, subj.gradeTag],
      updated: new Date().toISOString()
    };
  });
}

function buildHtmlEntriesForSubject(subj) {
  const dir = `anki-project/modules/${subj.key}`;
  const files = listFiles(dir, ['.html', '.htm']);
  return files.map(fp => {
    const html = fs.readFileSync(fp, 'utf-8');
    const title = extractTitle(html) || path.basename(fp);
    const publicPath = '/' + fp.replace(/\\/g, '/'); // /anki-project/modules/xxx.html
    return {
      type: 'html',
      title,
      path: publicPath,
      tags: ['noimg', subj.titleTag, subj.gradeTag],
      updated: new Date().toISOString()
    };
  });
}

function uniqueByKey(items) {
  const seen = new Set();
  return items.filter(x => {
    const key = x.path || x.data || JSON.stringify(x);
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}

(function main(){
  const all = [];
  for (const subj of SUBJECTS) {
    all.push(...buildMarkerEntriesForSubject(subj));
    all.push(...buildHtmlEntriesForSubject(subj));
  }
  const items = uniqueByKey(all)
    .sort((a,b) => (Date.parse(b.updated||'')||0) - (Date.parse(a.updated||'')||0));

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(items, null, 2), 'utf-8');
  console.log(`[OK] wrote ${OUT}  items=${items.length}`);
})();
