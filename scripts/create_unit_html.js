#!/usr/bin/env node
/**
 * create_unit_html.js — 単元ごとの独立HTML（マーカー式v3）を自動生成
 * 用途: B方式（独立HTML）を量産するためのCLI
 * 使い方例:
 *   node scripts/create_unit_html.js \
 *     --title "小4理科『人の体のつくりと運動』— 単元まとめ（図なし・マーカー式） v3" \
 *     --slug body_motion \
 *     --category sci \
 *     --out modules/sci
 *
 * オプション:
 *  --title     必須  ページ<title>と見出しに使用
 *  --slug      必須  出力HTMLファイル名（<slug>.html）
 *  --category  任意  sci | geo（デフォルト: sci）
 *  --out       任意  出力ディレクトリ（デフォルト: modules/sci）
 *  --withImage 任意  trueなら図ありカードの雛形を含める（デフォルト: true）
 */

const fs = require('fs');
const path = require('path');

// -------- arg parse --------
const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = a.match(/^--([^=]+)=(.*)$/);
  if (m) return [m[1], m[2]];
  if (a.startsWith('--')) return [a.replace(/^--/, ''), true];
  return [a, true];
}));

const title = args.title || '';
const slug = args.slug || '';
const category = (args.category || 'sci').trim();
const outDir = args.out || (category === 'geo' ? 'modules/geo' : 'modules/sci');
const withImage = String(args.withImage ?? 'true') !== 'false';

if (!title || !slug) {
  console.error('[ERR] --title と --slug は必須です');
  process.exit(1);
}

// -------- HTML template --------
const css = `:root{--bg:#f7f7fb;--card:#fff;--ink:#111827;--muted:#6b7280;--brand:#3b4675;--ok:#16a34a;--warn:#f59e0b;--ng:#ef4444;--mask:#9ca3af;--border:#e5e7eb}
html[data-theme=dark]{--bg:#0b1020;--card:#0f172a;--ink:#e5e7eb;--muted:#94a3b8;--brand:#9db1ff;--ok:#22c55e;--warn:#f59e0b;--ng:#ef4444;--mask:#475569;--border:#243044}
html,body{margin:0;background:var(--bg);color:var(--ink);font-family:system-ui,-apple-system,Segoe UI,Roboto,emoji}
header{padding:12px 16px;background:var(--card);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:10}
header h1{margin:0;font-size:18px;color:var(--brand)}
main{max-width:980px;margin:20px auto;padding:0 12px 60px}
.toolbar{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 16px}
button,.btn{appearance:none;border:1px solid var(--border);background:var(--card);border-radius:999px;padding:6px 12px;cursor:pointer;font-size:14px;color:var(--ink)}
button:hover,.btn:hover{box-shadow:0 1px 0 rgba(0,0,0,.08)}
.legend{margin-left:auto;display:flex;gap:8px;align-items:center}
.dot{width:10px;height:10px;border-radius:999px;display:inline-block;border:1px solid var(--border)}
.dot.ok{background:var(--ok)}.dot.warn{background:var(--warn)}.dot.ng{background:var(--ng)}
.card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:16px;margin:14px 0}
.qtitle{font-weight:700;margin:0 0 8px}
.qbody{line-height:1.9;font-size:16px}
.qactions{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}
.qactions button{font-size:12px;padding:6px 10px}
.qmeta{color:var(--muted);font-size:12px;margin-top:6px}
.note{font-size:12px;color:var(--muted)}
.kbd{font:12px monospace;padding:2px 6px;border:1px solid var(--border);border-radius:6px;background:var(--card);color:var(--ink)}
.mask{--mask-bg:var(--mask);display:inline-block;min-width:2.2em;color:transparent;background:linear-gradient(0deg,var(--mask-bg),var(--mask));border-radius:6px;padding:0 .4em;cursor:pointer;position:relative;transition:filter .15s ease;user-select:none}
.mask:after{content:"　"}
.mask:hover{filter:brightness(.95)}
.mask.revealed{color:var(--ink);background:transparent;border-bottom:1px dashed #64748b}
.mask[data-level=ok]{box-shadow:inset 0 0 0 2px var(--ok)}
.mask[data-level=warn]{box-shadow:inset 0 0 0 2px var(--warn)}
.mask[data-level=ng]{box-shadow:inset 0 0 0 2px var(--ng)}
.qcard{border:2px solid transparent;border-radius:14px;padding:10px}
.qcard[data-level=ok]{border-color:var(--ok)}
.qcard[data-level=warn]{border-color:var(--warn)}
.qcard[data-level=ng]{border-color:var(--ng)}
.imgmask{position:relative;max-width:720px;margin:8px 0}
.imgmask img{width:100%;height:auto;border-radius:12px;border:1px solid var(--border)}
.mask.abs{position:absolute;display:flex;align-items:center;justify-content:center}`;

const js = `const LS={get:k=>{try{return JSON.parse(localStorage.getItem(k))}catch{return null}},set:(k,v)=>localStorage.setItem(k,JSON.stringify(v)),del:k=>localStorage.removeItem(k)};
const KM=id=>`+"`"+`mask:${id}`+"`"+`,KQ=qid=>`+"`"+`qlevel:${qid}`+"`"+`,KT='pref:theme';
const themeBtn=document.getElementById('toggle-theme');
const savedTheme=LS.get(KT);if(savedTheme){document.documentElement.setAttribute('data-theme',savedTheme)}
themeBtn.addEventListener('click',()=>{const cur=document.documentElement.getAttribute('data-theme')||'light';const next=(cur==='dark')?'light':'dark';document.documentElement.setAttribute('data-theme',next);LS.set(KT,next)});
function reveal(el,text){el.classList.add('revealed');el.textContent=text}
function conceal(el){el.classList.remove('revealed');el.textContent='　'}
function applySavedState(el){const s=LS.get(KM(el.dataset.id));if(!s)return;if(s.ans)reveal(el,s.ans);if(s.level)el.setAttribute('data-level',s.level)}
function saveMask(el){const obj=LS.get(KM(el.dataset.id))||{};if(el.classList.contains('revealed'))obj.ans=el.textContent;LS.set(KM(el.dataset.id),obj)}
function hintOne(el){if(el.classList.contains('revealed'))return;const h=el.dataset.hint;if(h)el.textContent=h}
function cycleLevel(el){const order=[null,'ok','warn','ng',null];const cur=el.getAttribute('data-level')||null;const next=order[order.indexOf(cur)+1];if(next)el.setAttribute('data-level',next);else el.removeAttribute('data-level');const obj=LS.get(KM(el.dataset.id))||{};obj.level=next||undefined;LS.set(KM(el.dataset.id),obj)}
function addLongPressPeek(el){let t=null;const down=e=>{if(e.button===2)return;t=setTimeout(()=>{el.dataset._peek='1';reveal(el,el.dataset.answer)},700)};const up=()=>{clearTimeout(t);if(el.dataset._peek==='1'){el.dataset._peek='';const saved=LS.get(KM(el.dataset.id));if(!saved||!saved.ans)conceal(el)}};el.addEventListener('mousedown',down);el.addEventListener('touchstart',down,{passive:true});['mouseup','mouseleave','touchend','touchcancel'].forEach(ev=>el.addEventListener(ev,up))}
document.querySelectorAll('.mask').forEach(el=>{applySavedState(el);addLongPressPeek(el);el.addEventListener('click',()=>{reveal(el,el.dataset.answer);saveMask(el)});el.addEventListener('contextmenu',e=>{e.preventDefault();cycleLevel(el)});let touches=0,timer=null;el.addEventListener('touchstart',e=>{touches=e.touches.length;clearTimeout(timer);timer=setTimeout(()=>{if(touches>=2)cycleLevel(el)},120)},{passive:true})});
document.querySelectorAll('.qcard').forEach(card=>{const qid=card.dataset.qid;const saved=LS.get(KQ(qid));if(saved)card.setAttribute('data-level',saved);card.querySelectorAll('.qactions button[data-level]').forEach(btn=>{btn.addEventListener('click',()=>{const lvl=btn.dataset.level;card.setAttribute('data-level',lvl);LS.set(KQ(qid),lvl)})});card.querySelector('.qactions button[data-reset]')?.addEventListener('click',()=>{card.querySelectorAll('.mask').forEach(el=>{conceal(el);LS.del(KM(el.dataset.id));el.removeAttribute('data-level')});card.removeAttribute('data-level');LS.del(KQ(qid))})});
document.getElementById('reset-all').addEventListener('click',()=>{if(!confirm('全ての表示・復習状態をリセットします。よろしいですか？'))return;Object.keys(localStorage).filter(k=>k.startsWith('mask:')||k.startsWith('qlevel:')).forEach(k=>localStorage.removeItem(k));location.reload()});
let filterNG=false;document.getElementById('filter-ng').addEventListener('click',()=>{filterNG=!filterNG;document.querySelectorAll('.qcard').forEach(card=>{if(!filterNG){card.style.display='';return}const hasNGMask=!!card.querySelector('.mask[data-level="ng"]');const cardNG=card.getAttribute('data-level')==='ng';card.style.display=(hasNGMask||cardNG)?'':'none'})});
document.getElementById('queue-ng').addEventListener('click',()=>{const masks=Array.from(document.querySelectorAll('.mask[data-level="ng"]'));if(!masks.length){alert('要復習（赤）の空欄がありません。');return}let i=0;const hilite=el=>{el.scrollIntoView({behavior:'smooth',block:'center'});el.style.outline='2px solid var(--ng)';setTimeout(()=>el.style.outline='',1200)};hilite(masks[i]);const next=()=>{i=(i+1)%masks.length;hilite(masks[i])};document.addEventListener('keydown',function onk(e){if(e.key==='Enter'){next()}if(e.key==='Escape'){document.removeEventListener('keydown',onk)}});alert('赤の空欄を順番に出題します。Enterで次へ、Escで終了。')});
document.getElementById('export').addEventListener('click',()=>{const data={theme:document.documentElement.getAttribute('data-theme')||'light'};for(const [k,v] of Object.entries(localStorage)){if(k.startsWith('mask:')||k.startsWith('qlevel:'))data[k]=v}const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='unit_state.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)});document.getElementById('import-file').addEventListener('change',e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const data=JSON.parse(r.result);Object.keys(data).forEach(k=>{if(k.startsWith('mask:')||k.startsWith('qlevel:'))localStorage.setItem(k,data[k])});if(data.theme){document.documentElement.setAttribute('data-theme',data.theme);LS.set('pref:theme',data.theme)}alert('インポート完了。再読み込みします。');location.reload()}catch(err){alert('JSONの読み込みに失敗しました。')}};r.readAsText(f,'utf-8')});document.addEventListener('keydown',e=>{if(e.key==='h'||e.key==='H'){document.querySelectorAll('.mask').forEach(hintOne)}if(e.key==='r'||e.key==='R'){document.getElementById('reset-all').click()}});`;

const imgBlock = withImage ? `
  <!-- 図ありカード（必要に応じて座標を%で調整） -->
  <div class="card qcard" data-qid="qz1">
    <p class="qtitle">図を見て答えよう（サンプル）</p>
    <div class="qbody">
      <div class="imgmask">
        <img src="/anki-project/assets/img/sci/sample.webp" alt="図（差し替え）">
        <span class="mask abs" data-id="z-1" data-answer="かた" style="left:10%;top:15%;width:18%;height:3%"></span>
        <span class="mask abs" data-id="z-2" data-answer="ひじ" style="left:60%;top:22%;width:18%;height:3%"></span>
        <span class="mask abs" data-id="z-3" data-answer="ひざ" style="left:65%;top:32%;width:18%;height:3%"></span>
      </div>
      <p class="note">※画像を差し替え、マスク座標（left/top/width/height）を%で調整してください。</p>
    </div>
    <div class="qactions">
      <button data-level="ok">✅ できた</button>
      <button data-level="warn">△ あやしい</button>
      <button data-level="ng">❌ 要復習</button>
      <button data-reset>表示をリセット</button>
    </div>
    <div class="qmeta">図版：/anki-project/assets/img/sci/sample.webp</div>
  </div>
` : '';

const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>${css}</style>
</head>
<body>
<header><h1>${title}</h1></header>
<main>
  <section class="toolbar" aria-label="操作パネル">
    <button class="btn" id="toggle-theme">🌓 テーマ</button>
    <button class="btn" id="filter-ng">🔴 要復習だけ</button>
    <button class="btn" id="queue-ng">🎯 赤キュー</button>
    <button class="btn" id="reset-all">♻️ 全リセット</button>
    <button class="btn" id="export">⬇️ 状態エクスポート</button>
    <label class="btn" for="import-file">⬆️ 状態インポート</label>
    <input type="file" id="import-file" accept="application/json" style="display:none">
    <div class="legend"><span class="dot ng"></span>赤 <span class="dot warn"></span>黄 <span class="dot ok"></span>緑</div>
  </section>

  <!-- ① サンプル（テキスト） -->
  <div class="card qcard" data-qid="q1">
    <p class="qtitle">① 見出し（書き換えてください）</p>
    <div class="qbody">
      例：人の体のかたい部分は <span class="mask" data-id="q1-a1" data-answer="ほね"></span> 、曲げるところは <span class="mask" data-id="q1-a2" data-answer="関節"></span> 、力でかたさが変わる部分は <span class="mask" data-id="q1-a3" data-answer="きん肉"></span> といいます。
    </div>
    <div class="qactions">
      <button data-level="ok">✅ できた</button>
      <button data-level="warn">△ あやしい</button>
      <button data-level="ng">❌ 要復習</button>
      <button data-reset>表示をリセット</button>
    </div>
    <div class="qmeta">テンプレート：文章内マスク</div>
  </div>

  ${imgBlock}

  <div class="card">
    <details><summary>ショートカット / 操作ヒント</summary>
      <ul>
        <li>タップで表示、<b>長押し</b>でチラ見、<b>右クリック</b>で色（緑→黄→赤→無）。</li>
        <li>🌓 ライト/ダーク、🔴 要復習フィルタ、🎯 赤順出題（Enter次／Esc終了）。</li>
        <li>⬇️/⬆️ 学習状態のエクスポート/インポート。</li>
      </ul>
    </details>
  </div>
</main>
<script>${js}</script>
</body>
</html>`;

// -------- write file --------
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, `${slug}.html`);
fs.writeFileSync(outPath, html, 'utf-8');
console.log(`[OK] Generated: ${outPath}`);
console.log(`Open -> ${path.posix.join('/', outDir, slug + '.html')}`);
