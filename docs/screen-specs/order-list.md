# 画面: 受注一覧

- **画面 ID**: `order-list`
- **ルート**: `/orders`

## 検索条件

| 項目 | 入力方式 | 備考 |
|------|---------|------|
| 受注番号 | テキスト | 例プレースホルダ |
| 契約先 | マスタ選択（取引先） | `GET /api/masters/parties` |
| 納期（From） | 日付 | クエリ `dueDateFrom` |
| 納期（To） | 日付 | クエリ `dueDateTo` |

## 結果一覧

| 列名 | 表示形式 | 備考 |
|------|---------|------|
| 受注番号 | テキスト | |
| 契約先 | テキスト | 名称表示 |
| 納入先 | テキスト | 名称表示 |
| 納期 | 日付 | |
| 金額合計 | 数値（カンマ区切り） | |
| 登録日時 | 日付／日時 | ISO 文字列は日時表示 |

## 行操作

- ダブルクリック → 受注編集（ルート `order-edit`、`/orders/:id/edit`・現状はプレースホルダ）
- 削除 → 行選択後に確認 → `DELETE /api/orders/{id}`（複数選択時は順次削除）

## 検索 API

| アクション | API | パラメータ概要 | レスポンス概要 |
|-----------|-----|--------------|--------------|
| 検索 | GET /api/orders | `orderNumber`, `contractPartyCode`, `dueDateFrom`, `dueDateTo`（すべて任意） | 受注一覧の JSON 配列 |

## F キー

- F1: 検索条件クリア（一覧 Spec の `keySpec` で上書き）
- F12: 検索実行

## 特記事項

- Spec の `searchParamMapping` で `contractParty` → `contractPartyCode` に変換する
- `masterCombobox` の値は `{ code, name }` のため、検索時は `.code` をクエリに載せる
