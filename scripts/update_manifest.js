// anki-project/scripts/update_manifest.js (ESM版)
// 各科目の manifest.json を生成（marker/noimg/HTML）
import fs from 'node:fs';
import path from 'node:path';

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
function uniqByKey(items){
  const seen = new Set();
  return items.filter(x=>{
    const k = x.path || x.data || JSON.stringify(x);
    if(seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// public URL 文字列にする（先頭に / を付け、区切りを / に統一）
const toPublicPath = fp => '/' + fp.replace(/\\/g,'/');

function buildMarkerItems(subj){
  const dir = path.join('anki-project/assets/data', subj.key, 'marker');
  return listFiles(dir, ['.json']).map(fp=>{
    let title = path.basename(fp);
    try { title = readJSON(fp).title || title; } catch {}
    const dataPath = toPublicPath(fp);
    const url = `/anki-project/modules/marker.html?data=${dataPath}&title=${encodeURIComponent(title)}`;
    return { type:'marker', title, data:dataPath, path:url, tags:['marker', subj.tag, subj.grade], updated:new Date().toISOString() };
  });
}

function buildNoimgItems(subj){
  const dir = path.join('anki-project/assets/data', subj.key, 'noimg');
  return listFiles(dir, ['.json']).map(fp=>{
    let title = path.basename(fp);
    try { title = readJSON(fp).title || title; } catch {}
    const dataPath = toPublicPath(fp);
    const url = `/anki-project/modules/noimg.html?data=${dataPath}&title=${encodeURIComponent(title)}`;
    return { type:'noimg', title, data:dataPath, path:url, tags:['noimg', subj.tag, subj.grade], updated:new Date().toISOString() };
  });
}

function buildHtmlItems(subj){
  const dir = path.join('anki-project/modules', subj.key);
  return listFiles(dir, ['.html','.htm']).map(fp=>{
    const html = fs.readFileSync(fp, 'utf-8');
    const title = extractTitle(html) || path.basename(fp);
    const publicPath = toPublicPath(fp);
    return { type:'html', title, path:publicPath, tags:['html', subj.tag, subj.grade], updated:new Date().toISOString() };
  });
}

function main(){
  for(const subj of SUBJECTS){
    const marker = buildMarkerItems(subj);
    const noimg  = buildNoimgItems(subj);
    const htmls  = buildHtmlItems(subj);

    const all = uniqByKey([...marker, ...noimg, ...htmls])
      .sort((a,b)=>(Date.parse(b.updated||'')||0)-(Date.parse(a.updated||'')||0));

    const out = path.join('anki-project/assets/data', subj.key, 'manifest.json');
    fs.mkdirSync(path.dirname(out), { recursive:true });
    fs.writeFileSync(out, JSON.stringify(all, null, 2), 'utf-8');
    console.log(`[OK] ${subj.key}: marker=${marker.length}, noimg=${noimg.length}, html=${htmls.length} -> ${out} (items=${all.length})`);
  }
}

main();
