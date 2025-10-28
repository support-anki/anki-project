// scripts/update_manifest.js
// Node 18+ ESM
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ====== パス設定 ======
const MANIFEST_SCI = path.resolve(__dirname, "..", "assets/data/sci/manifest.json");
const MANIFEST_GEO = path.resolve(__dirname, "..", "assets/data/geo/manifest.json");

const SCI_DIR_HTML = path.resolve(__dirname, "..", "modules/sci");
const NOIMG_DIR_SCI = path.resolve(__dirname, "..", "assets/data/sci/noimg");
const MARKER_DIR_SCI = path.resolve(__dirname, "..", "assets/data/sci/marker");
const MARKER_DIR_GEO = path.resolve(__dirname, "..", "assets/data/geo/marker");

const NOIMG_LAUNCHER_REL = "../noimg.html";     // modules/sci/index.html からの相対
const MARKER_LAUNCHER_REL = "../marker.html";   // modules/{sci|geo}/index.html からの相対

const DATA_PREFIX_ABS_SCI_NOIMG = "/anki-project/assets/data/sci/noimg/";
const DATA_PREFIX_ABS_SCI_MARKER = "/anki-project/assets/data/sci/marker/";
const DATA_PREFIX_ABS_GEO_MARKER = "/anki-project/assets/data/geo/marker/";

const DEFAULT_QS = "&voice=true&shuffle=true";

const UPDATED_TODAY = process.env.MANIFEST_UPDATED_DATE || new Date().toISOString().slice(0,10);

// ====== ユーティリティ ======
function exists(p){ try{ fs.accessSync(p); return true; } catch{ return false; } }
function readJSON(p){ return JSON.parse(fs.readFileSync(p, "utf-8")); }
function writeJSON(p, obj){ fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n"); }
function readText(p){ return fs.readFileSync(p, "utf-8"); }
function htmlTitle(html){ const m = html.match(/<title>([\s\S]*?)<\/title>/i); return m ? m[1].trim() : null; }
function htmlManifestBlock(html){ const m = html.match(/<!--\s*manifest:\s*({[\s\S]*?})\s*-->/i); if(!m) return null; try { return JSON.parse(m[1]); } catch { return null; } }

function upsert(manifest, entry){
  manifest.modules = manifest.modules || [];
  const i = manifest.modules.findIndex(m => m.path === entry.path);
  if(i >= 0){
    manifest.modules[i] = { ...manifest.modules[i], ...entry, title: entry.title || manifest.modules[i].title };
  } else {
    manifest.modules.push(entry);
  }
}
function sortByUpdatedDesc(manifest){ manifest.modules.sort((a,b)=> String(b.updated||"").localeCompare(String(a.updated||""))); }

// ====== SCI（従来＋marker） ======
function updateSci(){
  const manifest = exists(MANIFEST_SCI) ? readJSON(MANIFEST_SCI) : { title:"理科教材 一覧", modules: [] };

  // 1) modules/sci/*.html（index除く）
  if(exists(SCI_DIR_HTML)){
    const files = fs.readdirSync(SCI_DIR_HTML).filter(f=> f.endsWith(".html") && f !== "index.html");
    for(const f of files){
      const abs = path.join(SCI_DIR_HTML, f);
      const html = readText(abs);
      const meta = htmlManifestBlock(html) || {};
      const fallback = htmlTitle(html);
      const entry = {
        title: meta.title || fallback || f,
        path: f,
        thumbnail: meta.thumbnail,
        category: meta.category || "理科（小4）",
        tags: Array.isArray(meta.tags) ? meta.tags : [],
        updated: UPDATED_TODAY
      };
      upsert(manifest, entry);
    }
  }

  // 2) assets/data/sci/noimg/*.json
  if(exists(NOIMG_DIR_SCI)){
    const files = fs.readdirSync(NOIMG_DIR_SCI).filter(f=> f.endsWith(".json"));
    for(const f of files){
      const abs = path.join(NOIMG_DIR_SCI, f);
      const json = readJSON(abs);
      const title = json.title || f.replace(/\.json$/,"");
      const pathForManifest = `${NOIMG_LAUNCHER_REL}?data=${encodeURI(DATA_PREFIX_ABS_SCI_NOIMG + f)}&title=${encodeURIComponent(title)}${DEFAULT_QS}`;
      // sidecar
      const sidecar = abs.replace(/\.json$/i, ".meta.json");
      let extra = {};
      if(exists(sidecar)){ try{
        const meta = readJSON(sidecar);
        if(typeof meta.thumbnail === "string") extra.thumbnail = meta.thumbnail;
        if(typeof meta.category === "string")  extra.category  = meta.category;
        if(Array.isArray(meta.tags))           extra.tags      = meta.tags;
      }catch{}}
      upsert(manifest, { title, path: pathForManifest, ...extra, updated: UPDATED_TODAY });
    }
  }

  // 3) assets/data/sci/marker/*.json
  if(exists(MARKER_DIR_SCI)){
    const files = fs.readdirSync(MARKER_DIR_SCI).filter(f=> f.endsWith(".json"));
    for(const f of files){
      const abs = path.join(MARKER_DIR_SCI, f);
      const json = readJSON(abs);
      const title = json.title || f.replace(/\.json$/,"");
      const pathForManifest = `${MARKER_LAUNCHER_REL}?data=${encodeURI(DATA_PREFIX_ABS_SCI_MARKER + f)}&title=${encodeURIComponent(title)}`;
      upsert(manifest, {
        title, path: pathForManifest,
        category: "理科（プリント型）",
        tags: ["marker","プリント","穴埋め"],
        updated: UPDATED_TODAY
      });
    }
  }

  sortByUpdatedDesc(manifest);
  writeJSON(MANIFEST_SCI, manifest);
  console.log("[update_manifest] updated SCI:", MANIFEST_SCI);
}

// ====== GEO（markerのみ追加：安全に追記） ======
function updateGeo(){
  if(!exists(MANIFEST_GEO)){ writeJSON(MANIFEST_GEO, { title:"社会教材 一覧", modules: [] }); }
  const manifest = readJSON(MANIFEST_GEO);

  if(exists(MARKER_DIR_GEO)){
    const files = fs.readdirSync(MARKER_DIR_GEO).filter(f=> f.endsWith(".json"));
    for(const f of files){
      const abs = path.join(MARKER_DIR_GEO, f);
      const json = readJSON(abs);
      const title = json.title || f.replace(/\.json$/,"");
      const pathForManifest = `${MARKER_LAUNCHER_REL}?data=${encodeURI(DATA_PREFIX_ABS_GEO_MARKER + f)}&title=${encodeURIComponent(title)}`;
      upsert(manifest, {
        title, path: pathForManifest,
        category: "社会（プリント型）",
        tags: ["marker","プリント","穴埋め"],
        updated: UPDATED_TODAY
      });
    }
  }
  sortByUpdatedDesc(manifest);
  writeJSON(MANIFEST_GEO, manifest);
  console.log("[update_manifest] updated GEO:", MANIFEST_GEO);
}

function main(){ updateSci(); updateGeo(); }
main();
