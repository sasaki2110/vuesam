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

`GET /api/orders` は **1要素＝明細1行**（ヘッダ項目は同一受注で繰り返し）。ツールバーは **明細行数** と **受注 ID のユニーク件数** を表示する。受注ヘッダ系の列は AG Grid **Row Spanning**（`enableCellSpan` + `spanRows`）で同一受注内の縦結合し、`spanRowsGroupField: id` で別受注同士の誤結合を防ぐ。

| 列名 | 表示形式 | 配置 | 備考 |
|------|---------|------|------|
| 受注番号 | テキスト | 左 | |
| 行 | 数値 | 左 | `lineNo` |
| 製品コード | テキスト | 左 | |
| 製品名 | テキスト | 左 | null のとき空表示 |
| 数量 | 数値 | **右** | Spec: `align: 'right'` |
| 単価 | 数値 | **右** | 同上 |
| 明細金額 | 数値 | **右** | `amount` |
| 契約先 | テキスト | 左 | 名称（null 可） |
| 納入先 | テキスト | 左 | 名称（null 可） |
| 納期 | 日付 | 左 | null 可 |
| 受注合計 | 数値 | **右** | `totalAmount`（行ごと同じ） |
| 明細行数 | 数値 | 左 | `lineCount`（行ごと同じ） |
| 登録日時 | 日付／日時 | 左 | ISO 文字列は日時表示 |

一覧の `resultColumns` で **`align: 'right'`** を付けると、AG Grid の `ag-right-aligned-cell` / `ag-right-aligned-header` が付き、数値列を右詰め表示できる（`format: 'number'` とは独立に指定可能）。

## 行操作

- ダブルクリック → 受注変更（ルート `order-edit`、`/orders/:id/edit`）。パラメータは受注ヘッダの `id`
- 変更（F10）／ツールバー「変更（F10）」→ 行選択時、上記と同じルートへ（未選択時はアラート）
- 削除 → 行選択後に確認 → `DELETE /api/orders/{id}`（**受注 ID** で削除。同一受注の複数明細行を選んでも API は受注単位で 1 回ずつ）

## 検索 API

| アクション | API | パラメータ概要 | レスポンス概要 |
|-----------|-----|--------------|--------------|
| 検索 | GET /api/orders | `orderNumber`, `contractPartyCode`, `dueDateFrom`, `dueDateTo`（すべて任意） | 明細フラットの JSON 配列（型は `OrderListItem`） |

## F キー

- F1: 検索条件クリア（一覧 Spec の `keySpec` で上書き）
- F10: 選択行の受注を変更画面へ（`KeyActionId` `edit`、`ListScreenView` のハンドラ）
- F12: 検索実行

**表示**: F1／F12 は画面上部ヘッダ右のボタン。F10 はグリッド直上ツールバーの「変更（F10）」ボタンでも操作できる。

## 特記事項

- 結果一覧テーブルの **配置**列が「右」の列は、`ORDER_LIST_SPEC.resultColumns` で `align: 'right'`（Markdown 定義 → Spec への写し）
- Spec の `searchParamMapping` で `contractParty` → `contractPartyCode` に変換する
- `masterCombobox` の値は `{ code, name }` のため、検索時は `.code` をクエリに載せる
- グリッドの行 ID は `listRowIdField: lineId`（明細行単位で一意）
