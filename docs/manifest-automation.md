# ✅ 理科教材 manifest 自動更新仕様

## 対象
- `assets/data/sci/noimg/*.json`（noimg教材）
- `modules/sci/*.html`（独立教材）

## 動作概要
教材追加/更新時、
GitHub Actions が manifest を自動更新。
孤児の削除も自動。

## 運用ルール

| 種別 | 必須項目 | 備考 |
|---|---|---|
| JSON教材 | `"title"` | 一覧に表示される名称 |
| サイドカー | `.meta.json` | thumbnail, tags など補完 |
| HTML教材 | manifestコメント ※任意 | 無ければ `<title>` を使用 |

### JSON → manifest の path 自動生成仕様

