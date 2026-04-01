# 画面: 受注変更

- **画面 ID**: （登録 Spec を共有）`order-new` の `OrderScreenSpec` を `resolveOrderScreenSpec('order-new')` で利用
- **ルート**: `/orders/:id/edit`（ルート名 `order-edit`）
- **初期明細行数**: 取得した明細行数に、空行を足して **合計 18 行**（`INITIAL_ROWS`、登録画面と同じ操作性）

## 概要

一覧または URL から受注 ID を渡し、**GET でヘッダ・明細を読み込み**、編集後に **PUT で保存** する更新系画面。ヘッダ・明細・バリデーション・CommitRule・列定義は [order-new.md](./order-new.md) と **同一 Spec**（`orderNewSpec.ts` / `orderCommitRules.ts`）を共有する。

## ヘッダ・明細

[order-new.md](./order-new.md) の「ヘッダ」「明細グリッド」「値確定ルール」をそのまま適用。

## 表示上の差分

| 項目 | 内容 |
|------|------|
| タイトル | `受注変更（＜受注番号＞）` のように動的タイトル |
| 受注番号 | シェルの `headerSubtitle` で「受注番号: …」を表示（読み取り専用） |
| 左ボタン | 「一覧へ戻る（F01）」— 登録画面の「新規」とは別動作 |

## F キー

- F1: 一覧へ戻る（`KeyActionId` `backToList`。共通デフォルトの `new` は `keySpec` で上書き）
- F12: 保存（共通デフォルト）→ `PUT /api/orders/{id}`
- F8: モック alert（`orderNewSpec` の `keySpec` を共有する場合と同じ）

## マスタ・データソース

[order-new.md](./order-new.md) の「マスタ・データソース」と同じ。

## 画面アクション → API

| アクション | API | ボディ / 備考 | レスポンス概要 |
|-----------|-----|--------------|--------------|
| 初期表示 | GET /api/orders/{id} | — | ヘッダ項目 + `lines`（各明細に `lineId` / `lineNo` 等。フロントは表示・PUT 用にマッピング） |
| 保存（F12） | PUT /api/orders/{id} | POST /api/orders と **同一構造**（明細はサーバ側で洗い替え） | `{ orderId, orderNumber, message }`（POST と同形が望ましい） |

404（取得・更新）・400（バリデーション）の扱いはバックエンド契約に従う。400 の JSON は登録画面と同じ [guide-for-humans.md の 4.3](../guide-for-humans.md#43-400-エラーレスポンスの契約最重要) を参照。

## 一覧からの遷移

- ダブルクリック: `ListScreenSpec.rowNavigation`（`order-edit` / `paramField: id`）
- 行選択 + F10 またはツールバー「変更（F10）」: 同じルートへ（未選択時はアラート）

## 特記事項

- 実装参照: `src/views/OrderEditPage.vue`
- 計画・経緯: [archive/update-roadmap/order-edit.md](../archive/update-roadmap/order-edit.md)
