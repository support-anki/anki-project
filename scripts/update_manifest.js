// scripts/update_subject_manifests.js
// 各科目ごとの manifest.json を自動生成（marker / noimg / HTML すべて対応）
const fs = require('fs');
const path = require('path');

// === 対応科目 ===
const SUBJECTS = [
  { key: 'sci',  tag: '理科',  grade: '4年' },
  { key: 'geo',  tag: '地理',  grade: '4年' },
  { key: 'jpn',  tag: '国語',  grade: '4年' },
  { key: 'math', tag: '算数',  grade: '4年' }
];

// --- utility ---
const exists = p => { try { fs.accessSync(p); return true; } catch { return false; } };
const readJSON = p => JSON.parse(fs.readFileSync(p, 'utf-8'));
const listFiles = (dir, exts) => {
  if (!exists(dir)) return [];
  const out = [];
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) out.push(...listFiles(p, exts));
    else if (exts.includes(path.extname(f).toLowerCase())) out.push(p);
  }
  return out;
};
const extractTitle = html => (html.match(/<title>([^<]+)<\/title>/i)?.[1] || '').trim();
const uniqByKey = items => {
  const seen = new Set();
  return items.filter(x => {
    const k = x.path || x.data || JSON.stringify(x);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

// --- 各カテゴリ別の項目生成 ---
function buildMarkerItems(subj) {
  const dir = `anki-project/assets/data/${subj.key}/marker`;
  return listFiles(dir, ['.json']).map(fp => {
    let title = path.basename(fp);
    try { title = readJSON(fp).title || title; } catch {}
    const dataPath = '/' + fp.replace(/\\/g, '/');
    const url = `/anki-project/modules/marker.html?data=${dataPath}&title=${encodeURIComponent(title)}`;
    return {
      type: 'marker',
      title,
      data: dataPath,
      path: url,
      tags: ['marker', subj.tag, subj.grade],
      updated: new Date().toISOString()
    };
  });
}

function buildNoimgItems(subj) {
  const dir = `anki-project/assets/data/${subj.key}/noimg`;
  return listFiles(dir, ['.json']).map(fp => {
    let title = path.basename(fp);
    try { title = readJSON(fp).title || title; } catch {}
    const dataPath = '/' + fp.replace(/\\/g, '/');
    const url = `/anki-project/modules/noimg.html?data=${dataPath}&title=${encodeURIComponent(title)}`;
    return {
      type: 'noimg',
      title,
      data: dataPath,
      path: url,
      tags: ['noimg', subj.tag, subj.grade],
      updated: new Date().toISOString()
    };
  });
}

function buildHtmlItems(subj) {
  const dir = `anki-project/modules/${subj.key}`;
  return listFiles(dir, ['.html', '.htm']).map(fp => {
    const html = fs.readFileSync(fp, 'utf-8');
    const title = extractTitle(html) || path.basename(fp);
    const publicPath = '/' + fp.replace(/\\/g, '/');
    return {
      type: 'html',
      title,
      path: publicPath,
      tags: ['html', subj.tag, subj.grade],
      updated: new Date().toISOString()
    };
  });
}

// --- メイン処理 ---
(function main() {
  for (const subj of SUBJECTS) {
    const marker = buildMarkerItems(subj);
    const noimg  = buildNoimgItems(subj);
    const htmls  = buildHtmlItems(subj);

    const all = uniqByKey([...marker, ...noimg, ...htmls])
      .sort((a,b) => (Date.parse(b.updated||'')||0) - (Date.parse(a.updated||'')||0));

    const out = `anki-project/assets/data/${subj.key}/manifest.json`;
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(all, null, 2), 'utf-8');
    console.log(`[OK] wrote ${out} items=${all.length}`);
  }
})();
