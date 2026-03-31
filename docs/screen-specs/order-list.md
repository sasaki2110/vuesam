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

`GET /api/orders` は **1要素＝明細1行**（ヘッダ項目は同一受注で繰り返し）。ツールバーは **明細行数** と **受注 ID のユニーク件数** を表示する。

| 列名 | 表示形式 | 備考 |
|------|---------|------|
| 受注番号 | テキスト | |
| 行 | 数値 | `lineNo` |
| 製品コード | テキスト | |
| 製品名 | テキスト | null のとき空表示 |
| 数量 | 数値 | |
| 単価 | 数値 | |
| 明細金額 | 数値 | `amount` |
| 契約先 | テキスト | 名称（null 可） |
| 納入先 | テキスト | 名称（null 可） |
| 納期 | 日付 | null 可 |
| 受注合計 | 数値 | `totalAmount`（行ごと同じ） |
| 明細行数 | 数値 | `lineCount`（行ごと同じ） |
| 登録日時 | 日付／日時 | ISO 文字列は日時表示 |

## 行操作

- ダブルクリック → 受注編集（ルート `order-edit`、`/orders/:id/edit`・現状はプレースホルダ）。パラメータは受注ヘッダの `id`
- 削除 → 行選択後に確認 → `DELETE /api/orders/{id}`（**受注 ID** で削除。同一受注の複数明細行を選んでも API は受注単位で 1 回ずつ）

## 検索 API

| アクション | API | パラメータ概要 | レスポンス概要 |
|-----------|-----|--------------|--------------|
| 検索 | GET /api/orders | `orderNumber`, `contractPartyCode`, `dueDateFrom`, `dueDateTo`（すべて任意） | 明細フラットの JSON 配列（型は `OrderListItem`） |

## F キー

- F1: 検索条件クリア（一覧 Spec の `keySpec` で上書き）
- F12: 検索実行

## 特記事項

- Spec の `searchParamMapping` で `contractParty` → `contractPartyCode` に変換する
- `masterCombobox` の値は `{ code, name }` のため、検索時は `.code` をクエリに載せる
- グリッドの行 ID は `listRowIdField: lineId`（明細行単位で一意）
