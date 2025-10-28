# 暗記シート 学習サイト — 現行仕様まとめ v1.1（2025-10-20）

本ドキュメントは、これまでのチャットで合意/実装した **最新のサイト構成・データ仕様・テンプレート挙動** を一箇所に集約したものです。今後の制作・引き継ぎにそのまま使えます。

---

## 1. サイト構成（GitHub Pages）
- ルート: `https://support-anki.github.io/anki-project/`
- 主要ディレクトリ：

```
/                      ← トップ（index.html）
/modules/              ← ビュー（noimg.html / img.html ほか）
/modules/jp/manifest.json
/modules/sci/manifest.json
/modules/geo/manifest.json
/assets/css/
/assets/img/           ← 画像（地図・サムネ）
  └─ geo/             ← 地理画像
  └─ thumb/           ← サムネイル
/assets/data/
  ├─ jp/noimg/        ← 国語JSON
  ├─ sci/noimg/       ← 理科JSON
  └─ geo/
      ├─ noimg/      ← 地理（図なし）JSON
      └─ mapdata/    ← 地理（図あり）JSON
/assets/data/meta/site-meta.json
```

- **GitHub Pagesの絶対パス**: `/anki-project/...`
  - 画像やJSON参照はできるだけ **絶対パス** を推奨。
  - 相対パス利用時は `/modules/` からの相対で `../assets/...`。

---

## 2. ビュー（テンプレート）

### 2.1 `modules/noimg.html`（図なし・共通クイズ）
**主な機能（v1.1）**
- 文字サイズ拡大（body: 18px, 行間1.7）
- **正誤記録**（LocalStorage, 復習モード）
- **読み上げ**（個別/一括・速度調整・⏸/▶/⏹）
- **選択肢の拡張**：文字列配列に加え **オブジェクト配列**（画像/説明）
  - 表示キー例: `text` / `label` / `caption` / `hint` / `desc`
  - 判定は index / カタカナ / `key` / 表示テキスト / `id` に対応
- **クエリ**：`data`（必須）/ `title`（任意）/ `shuffle=true` / `voice=true` / `review=true`
- **LocalStorageキー**：`anki-noimg:${dataUrl}:results` , `...:rate`

**JSONスキーマ（noimg 共通）**
```json
{
  "title": "教材タイトル",
  "items": [
    {
      "id": "001",
      "q": "問題文（（　）で空欄を示す）",
      "answers": ["正解1"],
      "choices": [
        "ア：説明…",
        { "key": "A", "hint": "説明…", "img": "/anki-project/assets/img/...png" }
      ],
      "note": "補足（任意）"
    }
  ]
}
```

---

### 2.2 `modules/img.html`（図あり教材／共通テンプレート）
**主な機能**
- 画像上に番号マーカー（Leaflet + CRS.Simple）
- **クリックで答え表示**（右パネルカード）
- **正誤記録**（`anki-img:${dataUrl}:results`）
- 表示管理：答え常時表示/番号ラベル/全体表示/未表示リセット/JSONコピー/編集モード
- **編集モード（?edit=1）**：ドラッグで座標調整→「JSONをコピー」
- 複数画像タブ（`images[]`）

**クエリ**：`data`（必須）/ `title`（任意）/ `edit=1`（編集）

**JSONスキーマ（図あり）**
```json
{
  "title": "教材タイトル",
  "images": [
    { "id": "map1", "src": "/anki-project/assets/img/geo/todofuken-map.png", "width": 844, "height": 768, "label": "都道府県地図" }
  ],
  "points": [
    { "id": "1", "img": "map1", "x": 450, "y": 730, "label": "沖縄県", "answer": "那覇市" }
  ]
}
```

**注意**：`width/height` は実画像と一致させる。パスは `/anki-project/...` を推奨。

---

## 3. データ作成ガイド

### 3.1 図なし（noimg）
- 穴埋め・選択式（説明推奨）・カタカナ→漢字
- 画像が必要な設問は **説明付き選択肢**に置換するか除外
- IDは3桁連番（例："001"）
- 命名例：`{科目略}-{回}-{主題}.json` → `ge7-kyushu.json`

### 3.2 図あり（img）
- `images[]` に地図、`points[]` に番号と解答
- `&edit=1` でドラッグ調整→JSONコピー→保存

---

## 4. マニフェスト（一覧）
- パス：`/modules/{jp|sci|geo}/manifest.json`

**追加例**
```json
{
  "title": "県名と異なる県庁所在地（番号→県庁所在地）",
  "path": "../img.html?data=/anki-project/assets/data/geo/mapdata/geo-kencho.json&title=県名と異なる県庁所在地（番号→県庁所在地）",
  "thumbnail": "../assets/img/thumb/japan-kencho.png",
  "category": "社会・地理（図あり）",
  "tags": ["都道府県","県庁所在地","日本地図","図あり"],
  "updated": "YYYY-MM-DD"
}
```

---

## 5. 代表URL例
- 図なし：`/modules/noimg.html?data=/anki-project/assets/data/geo/noimg/ge7-kyushu.json&title=小4社会 第7回 九州地方`
- 図あり：`/modules/img.html?data=/anki-project/assets/data/geo/mapdata/ge-kyushu.json&title=九州地方の地図`
- 県庁所在地：`/modules/img.html?data=/anki-project/assets/data/geo/mapdata/geo-kencho.json&title=県名と異なる県庁所在地（番号→県庁所在地）`

---

## 6. 不具合と対処（抜粋）
- JSON 404 → 画面真っ白：`data=` URLを直接開いて200確認
- 画像不表示：パス/拡張子/大文字小文字
- 選択肢 `[object Object]` → 現行v1.1で解消（オブジェクト対応）
- 一括読み1問目二重 → cancelタイミング修正済み
