# Phase 4 補足: 一覧画面テンプレート（Markdown 定義）

登録画面向けの `phase4` 本文は [archive/screen-engine-roadmap/phase4.md](../archive/screen-engine-roadmap/phase4.md) を参照。

一覧画面の画面定義は、以下の見出し構成で書く。

```markdown
## 画面: ＜画面名＞一覧

- **画面 ID**: `<screen-id>-list`
- **ルート**: `/<resource>`

### 検索条件

| 項目 | 入力方式 | 備考 |
|------|---------|------|
| ...  | ...     | ...  |

### 結果一覧

| 列名 | 表示形式 | 備考 |
|------|---------|------|
| ...  | ...     | ...  |

### 行操作

- ダブルクリック → ＜遷移先画面＞
- 削除 → DELETE ＜APIパス＞

### 検索 API

| アクション | API | パラメータ概要 | レスポンス概要 |
|-----------|-----|--------------|--------------|
| 検索 | GET ＜APIパス＞ | ＜クエリパラメータ＞ | ＜レスポンス＞ |
```

実装例: [screen-specs/order-list.md](../screen-specs/order-list.md)
