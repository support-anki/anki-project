// 単元横断クイズエンジン（タグ選択・自信度4段階・復習優先・図表示対応）
const QuizEngine = (() => {
  // ▼ミックス対象にするJSON（必要に応じて増やしてください）
  const DEFAULT_SOURCES = [
    "/anki-project/assets/data/math/noimg/ma4-08-unit-v2.json"
  ];

  // URLに ?src=... を並べたらそれを優先（例：&src=/...v2.json&src=/...9.json）
  const fromURL = (() => {
    try { return (new URLSearchParams(location.search)).getAll("src"); }
    catch { return []; }
  })();
  const SOURCES = (fromURL && fromURL.length) ? fromURL : DEFAULT_SOURCES;

  const LS_PREFIX = "anki-mix:";

  const fetchJSON = (u) => fetch(u, {cache:"no-store"}).then(r=>{
    if(!r.ok) throw new Error(`fetch ${u} -> ${r.status}`);
    return r.json();
  });

  async function loadAll() {
    const packs = [];
    for (const src of SOURCES) {
      try { packs.push({src, data: await fetchJSON(src)}); }
      catch(e){ console.warn("load fail:", src, e); }
    }
    return packs;
  }

  function flatItems(src, data){
    return (data.items||[]).map(it => ({
      ...it,
      __src: src,
      tags: it.tags || data.tags || []
    }));
  }

  // ===== タグ一覧を収集 =====
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

  // ===== 学習履歴（直近3回平均）=====
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
        if (onlyLow) return (x.__avg ?? 0) < 1.5 || x.__seen < 3;   // 苦手だけ
        return (x.__avg ?? 0) < 2.0 || x.__seen < 3;                // 復習優先
      });
      // プールが少なすぎるときは補充
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
    const aim = item.aim ? `<div class="muted" style="margin-top:8px">ねらい：${item.aim}</div>` : "";

    const {avg, hist} = readHist(item.__src, item.id||item.q||"");
    const badge = avg==null ? "記録なし" : `直近3回 平均=${avg.toFixed(2)}（${hist.length}）`;

    el.innerHTML = `
      <div class="muted">Q${idx+1}/${total}　<small>${item.__src}</small> ｜ ${badge}</div>
      <div class="q">${item.q}</div>
      ${figHTML(item.figure, withImages)}
      ${tags ? `<div style="margin-top:6px">${tags}</div>` : ""}
      <details style="margin-top:8px"><summary class="btn">ヒント（使う作戦は？）</summary>
        <div class="answer">${item.hint || "内角の和／外角の和／対角線／等積変形／特殊三角形 などから選ぶ"}</div>
      </details>
      <button class="btn" id="reveal${idx}" style="margin-top:10px">こたえを表示</button>
      <div id="ans${idx}" class="answer" style="display:none;margin-top:10px;"></div>
      <div class="row" style="margin-top:10px">
        <button class="btn" id="c0_${idx}">🔁 もう一度</button>
        <button class="btn" id="c1_${idx}">△ むずかしい</button>
        <button class="btn" id="c2_${idx}">○ だいたい</button>
        <button class="btn" id="c3_${idx}">◎ かんぺき</button>
      </div>
      ${aim}
    `;
    document.querySelector(container).appendChild(el);

    document.getElementById(`reveal${idx}`).onclick = ()=>{
      const box = document.getElementById(`ans${idx}`);
      const ans = (item.answers||[]).join(" ／ ");
      const note = item.note ? `\n— 解説：${item.note}` : "";
      box.textContent = `答え：${ans}${note}`;
      box.style.display = "block";
    };

    // 自信度（0..3）を履歴に記録
    ["c0_","c1_","c2_","c3_"].forEach((p,conf)=>{
      document.getElementById(p+idx).onclick = ()=>pushHist(item.__src, item.id||item.q||"", conf);
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
