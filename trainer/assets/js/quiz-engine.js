// 単元横断クイズエンジン（カタログ対応・科目タグ自動付与・タグ選択・復習優先）
const QuizEngine = (() => {
  const DEFAULT_CATALOG = "/anki-project/assets/data/meta/mix-sources.json";

  const q = new URLSearchParams(location.search);
  const DEBUG = q.get("debug") === "1";
  const CAT_URL = q.get("catalog") || DEFAULT_CATALOG;

  // ★ 追加：ヒント表示スイッチ（?hint=0 で完全OFF）
  const HINT_ENABLED = q.get("hint") !== "0";

  const srcFromURL = (() => {
    try { return q.getAll("src"); } catch { return []; }
  })();

  const LS_PREFIX = "anki-mix:";

  const fetchJSON = (u) => fetch(u, {cache:"no-store"}).then(r=>{
    if(!r.ok) throw new Error(`fetch ${u} -> ${r.status}`);
    return r.json();
  });

  async function loadCatalog(catUrl){
    try{
      const data = await fetchJSON(catUrl);
      const list = Array.isArray(data) ? data : (Array.isArray(data.sources) ? data.sources : []);
      return list.filter(Boolean);
    }catch(e){
      console.warn("catalog load failed:", catUrl, e);
      return [];
    }
  }

  async function loadAll() {
    const sources = (srcFromURL && srcFromURL.length) ? srcFromURL : await loadCatalog(CAT_URL);
    const packs = [];
    for (const src of sources) {
      try { packs.push({src, data: await fetchJSON(src)}); }
      catch(e){ console.warn("load fail:", src, e); }
    }
    return packs;
  }

  function subjectTagFromPath(src){
    const s = src || "";
    if (s.includes("/math/")) return "算数";
    if (s.includes("/jp/"))   return "国語";
    if (s.includes("/sci/"))  return "理科";
    if (s.includes("/geo/"))  return "社会";
    return null;
  }

  function flatItems(src, data){
    const subj = subjectTagFromPath(src);
    return (data.items || []).map(it => {
      const tags = [...(it.tags || []), ...((data.tags || []))];
      if (subj && !tags.includes(subj)) tags.push(subj);
      return { ...it, __src: src, tags };
    });
  }

  async function discoverTags(){
    const packs = await loadAll();
    const count = new Map();
    for (const p of packs) {
      for (const it of flatItems(p.src, p.data)) {
        (it.tags||[]).forEach(t => count.set(t, (count.get(t)||0)+1));
      }
    }
    const tags = [...count.entries()].map(([name,count])=>({name,count}));
    return { tags, sources: packs.map(p=>p.src) };
  }

  function byTags(items, tags){
    if(!tags || !tags.length) return items;
    const set = new Set(tags);
    return items.filter(it => it.tags && it.tags.some(t=>set.has(t)));
  }

  const key = (src,id)=>`${LS_PREFIX}${src}#${id}`;

  function readHist(src,id){
    try{
      const arr = JSON.parse(localStorage.getItem(key(src,id))||"[]");
      const last3 = arr.slice(-3);
      const avg = last3.length ? last3.reduce((a,b)=>a+b.c,0)/last3.length : null;
      return {hist:last3, avg};
    }catch{ return {hist:[], avg:null}; }
  }

  function pushHist(src,id,conf){
    let arr=[]; try{ arr = JSON.parse(localStorage.getItem(key(src,id))||"[]"); }catch{}
    arr.push({t:Date.now(), c:conf});
    if(arr.length>10) arr = arr.slice(-10);
    localStorage.setItem(key(src,id), JSON.stringify(arr));
  }

  const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};

  function pick(all, {needReview=false, onlyLow=false, limit=10, shuffleOK=true}){
    const scored = all.map(it=>{
      const {avg, hist} = readHist(it.__src, it.id||it.q||"");
      return {...it, __avg:avg, __seen:hist.length};
    });

    let pool = scored;
    if (needReview || onlyLow) {
      pool = scored.filter(x=>{
        if (onlyLow) return (x.__avg ?? 0) < 1.5 || x.__seen < 3;
        return (x.__avg ?? 0) < 2.0 || x.__seen < 3;
      });
      if (pool.length < Math.max(5, limit))
        pool = [...pool, ...scored.filter(x=>!pool.includes(x))];
    }

    if (shuffleOK) shuffle(pool);
    return limit ? pool.slice(0, limit) : pool;
  }

  function figHTML(fig, withImages){
    if(!withImages || !fig || !fig.src) return "";
    const cap = fig.caption ? `<div class="muted" style="margin-top:4px">${fig.caption}</div>` : "";
    return `<div style="margin:10px 0"><img class="fig" src="${fig.src}">${cap}</div>`;
  }

  function render(container, item, idx, total, withImages){
    const el = document.createElement("div");
    el.className = "card";
    const tags = (item.tags||[]).map(t=>`<span class="pill">${t}</span>`).join("");

    const {avg, hist} = readHist(item.__src, item.id||item.q||"");
    const badgeText = avg==null ? "記録なし" : `直近3回 平均=${avg.toFixed(2)}（${hist.length}）`;
    const sourceInfo = DEBUG ? `　<small>${item.__src}</small>` : "";

    // ★ 変更：デフォルトの数学語群は削除。hint/aim が無いなら非表示
    const hintRaw = item.hint || (item.aim ? `ねらい：${item.aim}` : "");
    const hintBlock = (HINT_ENABLED && hintRaw)
      ? `<details style="margin-top:8px"><summary class="btn hint-toggle">ヒント（使う作戦は？）</summary>
           <div class="answer hint-panel">${hintRaw}</div>
         </details>`
      : "";

    el.innerHTML = `
      <div class="muted">Q${idx+1}/${total}${sourceInfo} ｜ <span id="badge${idx}">${badgeText}</span></div>
      <div class="q">${item.q}</div>
      ${figHTML(item.figure, withImages)}
      ${tags ? `<div style="margin-top:6px">${tags}</div>` : ""}
      ${hintBlock}
      <button class="btn" id="reveal${idx}" style="margin-top:10px" type="button">こたえを表示</button>
      <div id="ans${idx}" class="answer" hidden style="margin-top:10px;"></div>
      <div class="row rate-bar" style="margin-top:10px">
        <button class="btn" id="c0_${idx}" type="button">🔁 もう一度</button>
        <button class="btn" id="c1_${idx}" type="button">△ むずかしい</button>
        <button class="btn" id="c2_${idx}" type="button">○ だいたい</button>
        <button class="btn" id="c3_${idx}" type="button">◎ かんぺき</button>
      </div>
      <div id="flash${idx}" class="muted" style="margin-top:6px;display:none"></div>
    `;
    document.querySelector(container).appendChild(el);

// こたえ表示（トグル） — appendChild(el) の直後に置く
{
  const btn = document.getElementById(`reveal${idx}`);
  const box = document.getElementById(`ans${idx}`);
  if (!btn || !box) return; // 念のため

  // 事前レンダ：答え＋解説
  const ans = (item.answers || []).join(" ／ ") || "(未設定)";
  const note = item.note ? `\n— 解説：${item.note}` : "";

  // ① 改行が効くように
  box.style.whiteSpace = "pre-line";
  // ② 中身セット
  box.textContent = `答え：${ans}${note}`;

  let shown = false;
  const updateUI = ()=>{
    // display切替は hidden だとCSS衝突が少ない
    box.hidden = !shown;
    btn.textContent = shown ? "こたえを隠す" : "こたえを表示";
    btn.setAttribute("aria-pressed", shown ? "true" : "false");
  };
  updateUI();

  btn.addEventListener("click", ()=>{
    shown = !shown;
    updateUI();
  });
}

    // 評価ボタン
    const btnIds = ["c0_","c1_","c2_","c3_"].map(p=>p+idx);
    const disableBtns = (yes)=>{
      btnIds.forEach(id=>{
        const b = document.getElementById(id);
        b.disabled = !!yes;
        b.classList.toggle("saved", !!yes);
        b.setAttribute("aria-disabled", yes ? "true":"false");
      });
    };
    btnIds.forEach((id,conf)=>{
      document.getElementById(id).onclick = ()=>{
        pushHist(item.__src, item.id||item.q||"", conf);

        // 即時フィードバック
        const b = document.getElementById(`badge${idx}`);
        const {avg, hist} = readHist(item.__src, item.id||item.q||"");
        b.textContent = (avg==null) ? "記録なし" : `直近3回 平均=${avg.toFixed(2)}（${hist.length}）`;

        const flash = document.getElementById(`flash${idx}`);
        flash.textContent = "✓ 記録しました";
        flash.style.display = "block";

        disableBtns(true);
        setTimeout(()=>{ flash.style.display="none"; disableBtns(false); }, 900);
      };
    });
  }

  async function mount({container="#quizArea", tags=[], limit=10, shuffle=true, needReview=false, onlyLow=false, withImages=true}={}){
    const packs = await loadAll();
    let all = [];
    for (const p of packs) all.push(...flatItems(p.src, p.data));
    all = byTags(all, tags);

    const picked = pick(all, {needReview, onlyLow, limit, shuffleOK:shuffle});
    const root = document.querySelector(container); root.innerHTML = "";
    picked.forEach((it,i)=>render(container, it, i, picked.length, withImages));

    return {count: picked.length, used: packs.map(p=>p.src)};
  }

  return { mount, discoverTags };
})();
