// anki-project/scripts/update_manifest.js (ESM)
// 各科目の manifest.json を生成（marker / mapdata / noimg / html）
import fs from 'node:fs';
import path from 'node:path';

// === 設定：リポ内の実ディレクトリと公開URLのベース ===
const FS_ASSETS_BASE  = 'assets';   // ← 実際の配置はリポ直下の assets/
const FS_MODULES_BASE = 'modules';  // ← 実際の配置はリポ直下の modules/
const PUBLIC_BASE     = '/anki-project'; // ← 公開URLは /anki-project 配下

const SUBJECTS = [
  { key: 'sci',  tag: '理科',  grade: '4年' },
  { key: 'geo',  tag: '地理',  grade: '4年' },
  { key: 'jpn',  tag: '国語',  grade: '4年' },
  { key: 'math', tag: '算数',  grade: '4年' }
];

const exists = p => { try { fs.accessSync(p); return true; } catch { return false; } };
const readJSON = p => JSON.parse(fs.readFileSync(p, 'utf-8'));

function listFiles(dir, exts){
  if(!exists(dir)) return [];
  const out = [];
  for(const f of fs.readdirSync(dir)){
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if(st.isDirectory()) out.push(...listFiles(p, exts));
    else if(exts.includes(path.extname(f).toLowerCase())) out.push(p);
  }
  return out;
}

const extractTitle = html => (html.match(/<title>([^<]+)<\/title>/i)?.[1] || '').trim();

// 実ファイルパス → 公開URL（/anki-project でプレフィックス）
const toPublicURL = rel => `${PUBLIC_BASE}/${rel.replace(/\\/g,'/')}`;

function uniqByKey(items){
  const seen = new Set();
  return items.filter(x=>{
    const k = x.path || x.data || JSON.stringify(x);
    if(seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function buildMarkerItems(subj){
  const dir = path.join(FS_ASSETS_BASE, 'data', subj.key, 'marker'); // assets/data/<subj>/marker
  return listFiles(dir, ['.json']).map(fp=>{
    const rel = fp.replace(/\\/g,'/');
    let title = path.basename(fp);
    try { title = readJSON(fp).title || title; } catch {}
    const dataURL = toPublicURL(rel); // /anki-project/assets/...
    const url = `${PUBLIC_BASE}/modules/marker.html?data=${dataURL}&title=${encodeURIComponent(title)}`;
    return { type:'marker', title, data:dataURL, path:url, tags:['marker', subj.tag, subj.grade], updated:new Date().toISOString() };
  });
}

function buildMapdataItems(subj){
  // assets/data/<subj>/mapdata/*.json → modules/img.html?data=...
  const dir = path.join(FS_ASSETS_BASE, 'data', subj.key, 'mapdata');
  return listFiles(dir, ['.json']).map(fp=>{
    const rel = fp.replace(/\\/g,'/');
    let title = path.basename(fp);
    try { title = readJSON(fp).title || title; } catch {}
    const dataURL = toPublicURL(rel);
    const url = `${PUBLIC_BASE}/modules/img.html?data=${dataURL}&title=${encodeURIComponent(title)}`;
    return { type:'img', title, data:dataURL, path:url, tags:['img', subj.tag, subj.grade], updated:new Date().toISOString() };
  });
}

function buildNoimgItems(subj){
  const dir = path.join(FS_ASSETS_BASE, 'data', subj.key, 'noimg'); // assets/data/<subj>/noimg
  return listFiles(dir, ['.json']).map(fp=>{
    const rel = fp.replace(/\\/g,'/');
    let title = path.basename(fp);
    try { title = readJSON(fp).title || title; } catch {}
    const dataURL = toPublicURL(rel);
    const url = `${PUBLIC_BASE}/modules/noimg.html?data=${dataURL}&title=${encodeURIComponent(title)}`;
    return { type:'noimg', title, data:dataURL, path:url, tags:['noimg', subj.tag, subj.grade], updated:new Date().toISOString() };
  });
}

function buildHtmlItems(subj){
  const dir = path.join(FS_MODULES_BASE, subj.key); // modules/<subj>
  return listFiles(dir, ['.html','.htm']).map(fp=>{
    const rel = fp.replace(/\\/g,'/');
    const html = fs.readFileSync(fp, 'utf-8');
    const title = extractTitle(html) || path.basename(fp);
    const publicPath = toPublicURL(rel); // /anki-project/modules/...
    return { type:'html', title, path:publicPath, tags:['html', subj.tag, subj.grade], updated:new Date().toISOString() };
  });
}

function main(){
  for(const subj of SUBJECTS){
    const marker  = buildMarkerItems(subj);
    const mapdata = buildMapdataItems(subj); // ★ 新規追加
    const noimg   = buildNoimgItems(subj);
    const htmls   = buildHtmlItems(subj);

    const all = uniqByKey([...marker, ...mapdata, ...noimg, ...htmls])
      .sort((a,b)=>(Date.parse(b.updated||'')||0)-(Date.parse(a.updated||'')||0));

    const out = path.join(FS_ASSETS_BASE, 'data', subj.key, 'manifest.json'); // assets/data/<subj>/manifest.json
    fs.mkdirSync(path.dirname(out), { recursive:true });
    fs.writeFileSync(out, JSON.stringify(all, null, 2), 'utf-8');
    console.log(`[OK] ${subj.key}: marker=${marker.length}, mapdata=${mapdata.length}, noimg=${noimg.length}, html=${htmls.length} -> ${out} (items=${all.length})`);
  }
}
main();
