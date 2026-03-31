# AG Grid 開発基盤 — AI 向け実装リファレンス

> **このドキュメントは AI コーディング支援向けです。**
> 人間から画面定義 Markdown（`docs/screen-specs/<画面ID>.md`）を受け取ったとき、
> このリファレンスを参照して正確に実装してください。
>
> 人間向けの手引書は [guide-for-humans.md](./guide-for-humans.md) にあります。

---

## 目次

1. [ワークフロー全体像](#1-ワークフロー全体像)
2. [Markdown → TypeScript 変換の辞書](#2-markdown--typescript-変換の辞書)
3. [アーキテクチャ概要](#3-アーキテクチャ概要)
4. [ディレクトリ構成](#4-ディレクトリ構成)
5. [登録画面の実装手順](#5-登録画面の実装手順)
6. [一覧画面の実装手順](#6-一覧画面の実装手順)
7. [Spec リファレンス](#7-spec-リファレンス)
8. [グリッド列定義（ColDef）の組み立て方](#8-グリッド列定義coldefの組み立て方)
9. [Editor Registry — フィールド型システム](#9-editor-registry--フィールド型システム)
10. [Commit Rules — セル確定時ロジック](#10-commit-rules--セル確定時ロジック)
11. [バリデーション](#11-バリデーション)
12. [Enter ナビゲーション](#12-enter-ナビゲーション)
13. [ファンクションキー](#13-ファンクションキー)
14. [API クライアント](#14-api-クライアント)
15. [バックエンド API 契約](#15-バックエンド-api-契約)
16. [実装チェックリスト](#16-実装チェックリスト)

---

## 1. ワークフロー全体像

人間が `docs/screen-specs/<画面ID>.md` に画面仕様書を書き、AI に実装を依頼する。
AI は本ドキュメントと既存の実装例を参照し、以下を生成する。

```
人間が渡すもの                AI が生成するもの
────────────────              ──────────────────────────────────────
docs/screen-specs/            src/features/<screen>-screen/
  <画面ID>.md         ──→       <screen>NewSpec.ts      (Spec)
                                <screen>Grid.ts         (ColDef ビルダ)
                                <screen>CommitRules.ts   (確定時ルール)
                                <screen>Types.ts         (行データ型)
                              src/views/
                                <Screen>NewPage.vue      (ページ Vue)
                              src/api/client.ts への追加  (API 関数)
                              src/router/index.ts への追加 (ルート)

一覧の場合:
docs/screen-specs/            src/features/<screen>-screen/
  <画面ID>-list.md    ──→       <screen>ListSpec.ts      (ListScreenSpec)
                              src/features/screen-engine/
                                listScreenSpecRegistry.ts への追加
                              src/api/client.ts への追加  (検索・削除)
                              src/router/index.ts への追加
```

**参照すべき既存実装（テンプレート）**:
- 登録画面: `src/features/order-screen/` + `src/views/OrderNewPage.vue`
- 横展開例: `src/features/purchase-screen/` + `src/views/PurchaseNewPage.vue`
- 一覧画面: `src/features/order-screen/orderListSpec.ts` + `src/views/ListScreenView.vue`

---

## 2. Markdown → TypeScript 変換の辞書

画面定義 Markdown の表記を TypeScript の Spec にマッピングする際の対応表。

### 2.1 ヘッダ項目の入力方式 → `HeaderFieldSpec.editorType`

| Markdown の表現 | `editorType` | 備考 |
|---|---|---|
| マスタ選択、コンボ、プルダウン、取引先選択 | `'masterCombobox'` | `optionsRef` も設定 |
| テキスト、文字入力 | `'text'` | |
| 日付 | `'date'` | |

### 2.2 明細グリッドの型 → `resolveGridFieldTypePartial` の `fieldType`

| Markdown の表現 | `fieldType` | 備考 |
|---|---|---|
| コード選択（候補リスト付き）、コンボ | `'codeAutocomplete'` | `params.options` にマスタを渡す |
| テキスト、文字入力 | `'text'` | |
| 数値、数量、金額 | `'numeric'` | |
| 行番号 | `'readOnlyText'` | `pinned: 'left'` を付与 |
| 表示のみ、読み取り専用 | `'readOnlyText'` | |
| 自動計算、算出 | `'readOnlyComputed'` | `params.valueGetter` を設定 |

### 2.3 バリデーション列 → `ValidationRule[]`

| Markdown の表現 | `ValidationRule` | 備考 |
|---|---|---|
| 必須 | `{ type: 'required' }` | |
| — | なし（`validation` プロパティを省略） | |
| N 文字以上 | `{ type: 'minLength', value: N }` | |
| N 文字以下 | `{ type: 'maxLength', value: N }` | |
| 1 以上 | `{ type: 'custom', validate: ... }` | 数値の下限チェック |
| 正規表現: ＜パターン＞ | `{ type: 'pattern', regex: '...' }` | |
| その他の自由記述 | `{ type: 'custom', validate: ... }` | 内容に応じて実装 |

### 2.4 一覧の表示形式 → `ListResultColumn` プロパティ

| Markdown の表現 | `ListResultColumn` のプロパティ |
|---|---|
| テキスト | `format` 省略（既定） |
| 数値 | `format: 'number'` |
| 日付 / 日時 | `format: 'date'` |
| 右（配置列） | `align: 'right'` |
| 行スパン / 縦結合（備考列） | `spanRows: true` |

### 2.5 ヘッダ表の行順 → `NavigationSpec` / `searchFieldEnterOrder`

- 登録画面: ヘッダ表の行順 → `NavigationSpec.headerEnterOrder` に並べる
- 備考に「Enter 順から除外」がある項目は `headerEnterOrder` に含めない
- 一覧画面: ヘッダ表の行順 → `ListScreenSpec.searchFieldEnterOrder` に並べる

### 2.6 明細グリッド表の列順 → `NavigationSpec.gridEditChainColIds`

- 編集が「○」の列を上から順に `gridEditChainColIds` に並べる
- `gridEnterStopEditingColIds` も通常同じ配列にする
- `gridEntryColumnField` は最初の「○」列の `field`

### 2.7 F キー → `KeySpec`

- 「F1: 新規」「F12: 保存」は登録画面の共通デフォルト（`defaultKeySpec.ts`）→ Spec では省略可
- 「F1: 検索条件クリア」「F12: 検索実行」は一覧用 → `keySpec` に明示
- それ以外の `F<N>: <機能名>` → `keySpec` に追加。`KeyActionId` に新しいアクションが必要な場合は `screenSpecTypes.ts` に追加

---

## 3. アーキテクチャ概要

```
┌─────────────────────────────────────────────────────────┐
│  画面固有ページ (例: OrderNewPage.vue)                    │
│  ・Spec の選択、マスタ取得、保存処理、CommitRule 接続     │
├─────────────────────────────────────────────────────────┤
│  共通シェル                                              │
│  ・RegistrationScreenShell.vue  (登録系)                 │
│  ・ListScreenView.vue           (一覧系)                 │
│  ・ヘッダ描画、AG Grid、Fキー、Enter 連鎖               │
├─────────────────────────────────────────────────────────┤
│  screen-engine (共通ライブラリ層)                         │
│  ・screenSpecTypes.ts    … Spec の型定義                 │
│  ・editorRegistry.ts     … フィールド型 → ColDef 断片    │
│  ・applyCommitSpec.ts    … 確定時ルール実行              │
│  ・validation/           … バリデーション基盤             │
│  ・useGridEnterNav.ts    … Enter ナビ (グリッド)         │
│  ・useHeaderEnterNav.ts  … Enter ナビ (ヘッダ)          │
│  ・useKeySpec.ts         … Fキーハンドリング             │
└─────────────────────────────────────────────────────────┘
```

**設計原則:**
- 新しい画面を追加するとき、**既存の Vue コンポーネントを変更しない**
- 業務ロジックは **TypeScript の Spec / Rules** に集約し、Vue テンプレートを薄く保つ
- AG Grid の `ColDef` は画面固有モジュールで組み立て、共通シェルには完成品を渡す

---

## 4. ディレクトリ構成

```
src/
├── api/
│   └── client.ts                 # API クライアント (fetch ベース)
├── components/
│   └── grid/
│       └── ProductCodeCellEditor.vue  # カスタムセルエディタ
├── features/
│   ├── screen-engine/            # ★ 共通基盤（変更不要）
│   │   ├── screenSpecTypes.ts    #   Spec の型定義
│   │   ├── editorRegistry.ts     #   フィールド型レジストリ
│   │   ├── applyCommitSpec.ts    #   CommitRule 実行エンジン
│   │   ├── useGridEnterNav.ts    #   グリッド Enter ナビ
│   │   ├── useHeaderEnterNav.ts  #   ヘッダ Enter ナビ
│   │   ├── useListSearchEnterNav.ts  # 一覧検索 Enter ナビ
│   │   ├── useKeySpec.ts         #   ファンクションキー
│   │   ├── defaultKeySpec.ts     #   既定キー割当
│   │   ├── listScreenSpecRegistry.ts  # 一覧 Spec 解決
│   │   └── validation/           #   バリデーション
│   │       ├── validationTypes.ts
│   │       ├── validateFields.ts
│   │       ├── validateGridRows.ts
│   │       ├── agGridValidation.ts
│   │       └── parseApiErrors.ts
│   ├── order-screen/             # ★ 受注画面（テンプレート）
│   │   ├── orderNewSpec.ts       #   登録 Spec + ColDef ビルダ
│   │   ├── orderListSpec.ts      #   一覧 Spec
│   │   └── orderCommitRules.ts   #   確定時ルール
│   └── purchase-screen/          # ★ 発注画面（横展開例）
│       ├── purchaseNewSpec.ts
│       ├── purchaseGrid.ts
│       ├── purchaseTypes.ts
│       └── purchaseCommitRules.ts
├── types/
│   ├── order.ts                  # 受注のドメイン型
│   └── master.ts                 # マスタの共通型
├── views/
│   ├── RegistrationScreenShell.vue       # 登録画面の共通シェル（変更不要）
│   ├── registrationScreenShell.types.ts  # シェルの Props/Emits 型
│   ├── ListScreenView.vue                # 一覧画面の共通シェル（変更不要）
│   ├── OrderNewPage.vue                  # 受注登録ページ（テンプレート）
│   └── PurchaseNewPage.vue               # 発注登録ページ（横展開例）
├── router/                       # Vue Router
└── constants/
    └── mockData.ts               # 開発用モックマスタ
```

---

## 5. 登録画面の実装手順

画面定義 Markdown を受け取ったら、以下の手順で実装する。
`OrderNewPage.vue` + `order-screen/` を **テンプレートとしてコピー・改変** するのが最も確実。

### Step 1: feature ディレクトリを作成

```
src/features/<screen>-screen/
```

### Step 2: 行データの型を定義

Markdown の「明細グリッド」テーブルから行の型を導出する。

```typescript
// <screen>Types.ts
export type <Screen>LineRow = {
  lineNo: number
  // Markdown の各列に対応するフィールド
}
```

### Step 3: 画面 Spec を定義

Markdown のヘッダ表 → `HeaderFieldSpec[]`、明細グリッドの「編集○」列 → `NavigationSpec` に変換。

```typescript
// <screen>NewSpec.ts
export const <SCREEN>_HEADER_FIELDS: HeaderFieldSpec[] = [
  // Markdown のヘッダ表を変換（2.1 の辞書を使う）
]

const <SCREEN>_NAV: NavigationSpec = {
  headerEnterOrder: [/* ヘッダ表の行順。「Enter 順から除外」は除く */],
  gridEntryColumnField: '/* 最初の編集○列の field */',
  gridEditChainColIds: [/* 編集○の列を上から順に */],
  gridEnterStopEditingColIds: [/* 通常は gridEditChainColIds と同じ */],
}

export const <SCREEN>_GRID_VALIDATIONS: GridColumnValidation[] = [
  // Markdown のバリデーション列を変換（2.3 の辞書を使う）
]

export const <SCREEN>_NEW_SPEC = {
  id: '<screen>-new',
  title: '/* Markdown の画面名 */',
  gridHint: '/* Markdown の特記事項から要約 */',
  headerFields: <SCREEN>_HEADER_FIELDS,
  navigationSpec: <SCREEN>_NAV,
  keySpec: { /* Markdown のFキーから変換（2.7 の辞書を使う） */ },
}
```

### Step 4: 列定義（ColDef）ビルダを作成

Markdown の「明細グリッド」テーブルから `ColDef` 配列を構築する関数を作成。

```typescript
// <screen>Grid.ts
export function build<Screen>ColumnDefs(
  /* 必要なマスタを引数に */
): ColDef<<Screen>LineRow>[] {
  return [
    // 行番号列（常にある）
    {
      headerName: '行', field: 'lineNo', width: 52, pinned: 'left',
      ...resolveGridFieldTypePartial<...>({ fieldType: 'readOnlyText' }),
    },
    // 以降、Markdown の明細グリッド表の各行を ColDef に変換（2.2 の辞書を使う）
  ]
}
```

### Step 5: CommitRule を定義

Markdown の「値確定ルール（副作用）」セクションから実装する。

```typescript
// <screen>CommitRules.ts
// 「なし」なら空配列でよい
export const <screen>CommitRules: CommitRule<...>[] = [
  // 各箇条書きを CommitRule に変換
]
```

### Step 6: 行の初期化関数・追加関数・空行判定関数を作成

```typescript
// <screen>NewSpec.ts（または Types.ts）に含める
export const INITIAL_ROWS = /* Markdown の「初期明細行数」*/

export function createEmpty<Screen>Rows(): <Screen>LineRow[] { ... }
export function createNext<Screen>Row(prev: <Screen>LineRow[]): <Screen>LineRow { ... }
export function is<Screen>LineFilled(row: <Screen>LineRow): boolean { ... }
```

### Step 7: ページ Vue を作成

`OrderNewPage.vue` をコピーし、以下を差し替える:

| 差し替え箇所 | 内容 |
|---|---|
| import する Spec / Types | 新しい画面のもの |
| `buildColumnDefs` | `build<Screen>ColumnDefs(...)` |
| CommitRule | `apply<Screen>CommitSpec(...)` |
| `handleSave` | 新画面の API 呼び出し |
| バリデーション | `<SCREEN>_GRID_VALIDATIONS` |
| 行の初期化/追加 | `createEmpty<Screen>Rows()` / `createNext<Screen>Row()` |
| フィールドマッピング | API パス → fieldKey のマッピング（`parseApiErrors` 用） |

### Step 8: ルートを追加

```typescript
// src/router/index.ts
{
  path: '/<resource>/new',
  name: '<screen>-new',
  component: () => import('@/views/<Screen>NewPage.vue'),
}
```

### Step 9: ビルド確認

```bash
npm run build
```

---

## 6. 一覧画面の実装手順

一覧画面は登録画面より簡単。`ColDef` ビルダやページ Vue の作成は不要。

### Step 1: ListScreenSpec を定義

Markdown の各セクションを `ListScreenSpec` に変換する。

```typescript
// <screen>ListSpec.ts
export const <SCREEN>_LIST_SPEC: ListScreenSpec = {
  id: '<screen>-list',
  title: '/* Markdown の画面名 */',
  searchFields: [/* Markdown の「検索条件」表 → HeaderFieldSpec[] */],
  resultColumns: [/* Markdown の「結果一覧」表 → ListResultColumn[] (2.4 の辞書を使う) */],
  listRowIdField: '/* 明細行の一意キー（明細IDなど） */',
  spanRowsGroupField: '/* 行スパンのグループキー（ヘッダIDなど）。行スパンがなければ省略 */',
  toolbarOrderDistinctField: '/* 件数表示の重複排除キー。不要なら省略 */',
  rowNavigation: {
    routeName: '/* ダブルクリック遷移先のルート名 */',
    paramField: '/* パラメータに使うフィールド */',
  },
  deleteAction: /* Markdown の「行操作」に削除があれば */ {
    apiPath: '/* DELETE のパス */',
    idField: '/* 行データの ID フィールド */',
    confirmMessage: '/* 確認メッセージ */',
  } /* なければ null */,
  searchAction: {
    apiPath: '/* Markdown の「検索 API」のパス */',
  },
  searchParamMapping: {
    /* 検索フィールド id と API パラメータ名が異なる場合のみ */
  },
  searchFieldEnterOrder: [/* 検索条件表の行順 */],
  keySpec: {
    F1: 'clearSearch',
    F12: 'search',
  },
}
```

### Step 2: レジストリに登録

`src/features/screen-engine/listScreenSpecRegistry.ts` に Spec を追加。

### Step 3: API 関数を追加

`src/api/client.ts` に検索関数・削除関数を追加（既存の `fetchOrders` / `deleteOrder` をテンプレートに）。

### Step 4: ルートを追加

```typescript
// src/router/index.ts
{
  path: '/<resource>',
  name: '<screen>-list',
  component: () => import('@/views/ListScreenView.vue'),
  meta: { listSpecId: '<screen>-list' },
}
```

### Step 5: ビルド確認

```bash
npm run build
```

---

## 7. Spec リファレンス

### 7.1 HeaderFieldSpec — ヘッダ項目

| プロパティ | 型 | 説明 |
|---|---|---|
| `id` | `string` | フィールド識別子。reactive オブジェクトのキーと一致させる |
| `label` | `string` | 表示ラベル |
| `editorType` | `'masterCombobox' \| 'text' \| 'date'` | 入力コンポーネントの種類 |
| `placeholder?` | `string` | プレースホルダテキスト |
| `gridColumnSpan?` | `number` | 768px 以上でのグリッドカラムスパン |
| `optionsRef?` | `'parties'` | masterCombobox 用のマスタ参照キー |
| `defaultDatePlusDays?` | `number` | date 型の初期値（今日 + N日） |
| `validation?` | `ValidationRule[]` | バリデーションルール |

### 7.2 NavigationSpec — Enter チェーン

| プロパティ | 型 | 説明 |
|---|---|---|
| `headerEnterOrder` | `readonly string[]` | Enter で移動するヘッダ項目の順序。ここにない項目は Enter チェーンに含まない |
| `gridEntryColumnField` | `string` | ヘッダ最終項目の次にフォーカスするグリッド列の `field` |
| `gridEditChainColIds` | `readonly string[]` | グリッド内で Enter で移動する列（左→右の順） |
| `gridEnterStopEditingColIds` | `readonly string[]` | Enter で `stopEditing` する列 |

### 7.3 ListScreenSpec — 一覧画面

| プロパティ | 型 | 説明 |
|---|---|---|
| `id` | `string` | 画面識別子 |
| `title` | `string` | 画面タイトル |
| `searchFields` | `HeaderFieldSpec[]` | 検索条件のヘッダ項目 |
| `resultColumns` | `ListResultColumn[]` | 結果グリッドの列定義 |
| `listRowIdField?` | `string` | AG Grid の行キー |
| `toolbarOrderDistinctField?` | `string` | ツールバー件数表示の重複排除キー |
| `spanRowsGroupField?` | `string` | Row Spanning のグループキー |
| `rowNavigation` | `{ routeName, paramField }` | ダブルクリック時の遷移先 |
| `deleteAction` | `{ apiPath, idField, confirmMessage } \| null` | 削除操作の設定 |
| `searchAction` | `{ apiPath }` | 検索 API のパス |
| `searchParamMapping?` | `Record<string, string>` | 検索項目 id → API パラメータ名のマッピング |
| `searchFieldEnterOrder` | `readonly string[]` | 検索ヘッダの Enter 順序 |
| `keySpec` | `KeySpec` | ファンクションキー割当 |

### 7.4 ListResultColumn — 一覧列

| プロパティ | 型 | 説明 |
|---|---|---|
| `field` | `string` | データフィールド名 |
| `headerName` | `string` | 列ヘッダテキスト |
| `width?` | `number` | 列幅 (px) |
| `format?` | `'date' \| 'number' \| 'text'` | 表示フォーマット |
| `spanRows?` | `boolean` | 行スパンを有効にするか |
| `align?` | `'left' \| 'right' \| 'center'` | セル横位置 |

### 7.5 KeySpec — ファンクションキー

```typescript
type KeyActionId = 'new' | 'save' | 'mockAlert' | 'search' | 'clearSearch'
type FunctionKey = 'F1' | 'F2' | ... | 'F12'
type KeySpec = Partial<Record<FunctionKey, KeyActionId>>
```

---

## 8. グリッド列定義（ColDef）の組み立て方

### 登録画面の列定義

```typescript
import { resolveGridFieldTypePartial } from '@/features/screen-engine/editorRegistry'

export function buildXxxColumnDefs(products: readonly CodeMasterItem[]): ColDef<XxxRow>[] {
  return [
    {
      headerName: '行', field: 'lineNo', width: 52, pinned: 'left',
      ...resolveGridFieldTypePartial<XxxRow>({ fieldType: 'readOnlyText' }),
    },
    {
      headerName: '製品コード', field: 'productCode', width: 200,
      ...resolveGridFieldTypePartial<XxxRow>({
        fieldType: 'codeAutocomplete',
        params: { options: products },
      }),
      // 必要に応じて valueFormatter / valueParser をオーバーライド
    },
    // ...
  ]
}
```

**パターン**: 基本構造（`headerName`, `field`, `width`）を書き、
`resolveGridFieldTypePartial` をスプレッドして編集挙動を注入。
画面固有の `valueFormatter` / `valueParser` があればスプレッド後にオーバーライド。

### 一覧画面の列定義

一覧は `ListResultColumn[]` を宣言するだけ。`ListScreenView.vue` が自動変換する:

| `ListResultColumn` | `ColDef` への変換 |
|---|---|
| `format: 'number'` | `valueFormatter` で `toLocaleString('ja-JP')` |
| `format: 'date'` | `valueFormatter` で日付整形 |
| `spanRows: true` | `ColDef.spanRows` 設定 |
| `align: 'right'` | `cellClass: 'ag-right-aligned-cell'` |

---

## 9. Editor Registry — フィールド型システム

`editorRegistry.ts` は `Partial<ColDef>` をフィールド型から生成する。

### 利用可能なフィールド型

| 型名 | 用途 | 主な設定 |
|---|---|---|
| `codeAutocomplete` | コード入力（コンボ） | `ProductCodeCellEditor`, `cellEditorPopup: true` |
| `numeric` | 数値入力 | `numericColumn`, カンマ除去の `valueParser` |
| `text` | テキスト入力 | `editable: true, singleClickEdit: true` |
| `readOnlyText` | 表示専用 | `editable: false` |
| `readOnlyComputed` | 算出表示 | `editable: false`, カスタム `valueGetter` |

### 新しいフィールド型を追加する場合

1. `GRID_FIELD_TYPES` 配列に型名を追加
2. `GridFieldResolveInput` の union に新しいケースを追加
3. `resolveGridFieldTypePartial` の `switch` に処理を追加
4. カスタムセルエディタが必要なら `src/components/grid/` に作成し、ここから import

---

## 10. Commit Rules — セル確定時ロジック

Markdown の「値確定ルール（副作用）」セクションを実装する仕組み。

### 構造

```typescript
type CommitRule<TRow, TCtx extends { event: CellValueChangedEvent<TRow> }> = {
  onFields: readonly string[]   // トリガーする列の field 名
  apply: (ctx: TCtx) => void    // 実行する処理
}
```

### Markdown からの変換

| Markdown の記述 | 実装 |
|---|---|
| `製品コード確定 → 製品名を自動入力` | `onFields: ['productCode']`, `apply` で `node.setDataValue('productName', ...)` |
| `数量 or 単価の確定 → 金額を再計算` | `onFields: ['quantity', 'unitPrice']`, `apply` で `node.setDataValue('amount', q * u)` |
| `＜コード＞確定 → ＜別列＞にフォーカス移動` | `apply` で `event.api.setFocusedCell(row, '<col>')` + `startEditingCell` |

### 実装パターン

```typescript
export type <Screen>CommitContext = {
  event: CellValueChangedEvent<<Screen>LineRow>
  /* 必要なマスタ等を追加 */
}

export const <screen>CommitRules: CommitRule<...>[] = [
  { onFields: ['...'], apply: (ctx) => { /* ... */ } },
]

export function apply<Screen>CommitSpec(event: ..., /* マスタ等 */) {
  applyCommitSpec(<screen>CommitRules, { event, /* ... */ })
}
```

ページ Vue の `onCellValueChanged` からこの関数を呼び出す。

---

## 11. バリデーション

二層バリデーション: フロント（Spec 宣言ルール）と API 400 を同じ `FieldError` 形式で表示。

### FieldError の形式

```typescript
type FieldError = {
  fieldKey: string    // ヘッダ: field id (例: "contractParty")
                      // グリッド: "${rowIndex}:${colId}" (例: "0:productCode")
  message: string
}
```

### バリデーションルール

| 型 | パラメータ | 説明 |
|---|---|---|
| `required` | `message?` | 必須チェック |
| `minLength` | `value`, `message?` | 最小文字数 |
| `maxLength` | `value`, `message?` | 最大文字数 |
| `pattern` | `regex`, `message?` | 正規表現パターン |
| `custom` | `validate: (value) => string \| null` | カスタムバリデーション |

### ヘッダバリデーション

`HeaderFieldSpec.validation` にルールを宣言。保存時に呼び出す:

```typescript
const headerResult = validateHeaderFields(spec.headerFields, headerValues)
```

### グリッドバリデーション

`GridColumnValidation[]` を定義し、保存時に呼び出す:

```typescript
const gridResult = validateGridRows(rows, <SCREEN>_GRID_VALIDATIONS, is<Screen>LineFilled)
```

### エラー表示

```typescript
// ページの computed で列定義にバリデーションをマージ
const colDefs = computed(() =>
  build<Screen>ColumnDefs(...).map((c) => mergeColDefWithValidation(c, validationErrors))
)
```

### API 400 エラーのマッピング

```typescript
// 画面ごとにフィールドマッピングを定義
const <SCREEN>_FIELD_MAPPING: Record<string, string> = {
  // API の field パス → フロントの fieldKey
  'contractPartyCode': 'contractParty',
}

// parseApiErrors でマッピング
const { fieldErrors, globalMessage } = parseApiErrors(apiError.body, <SCREEN>_FIELD_MAPPING)
```

---

## 12. Enter ナビゲーション

```
ヘッダ項目 1  ──Enter──▶  ヘッダ項目 2  ──Enter──▶  ...
                                                       │
                                                       ▼
グリッド 1行目 col1 ──Enter──▶ col2 ──Enter──▶ col3
                                                  │
次行 col1 ◀───────────────────────────────────────┘
```

`NavigationSpec` の各プロパティで制御:
- `headerEnterOrder`: ヘッダの Enter 移動順
- `gridEntryColumnField`: ヘッダ最終 → グリッドの最初の列
- `gridEditChainColIds`: グリッド内の Enter 移動順
- `gridEnterStopEditingColIds`: Enter で `stopEditing` する列

---

## 13. ファンクションキー

### 組み込みアクション

| ActionId | 説明 | 典型的な割当 |
|---|---|---|
| `new` | 新規（行クリア） | F1（登録） |
| `save` | 保存 | F12（登録） |
| `search` | 検索実行 | F12（一覧） |
| `clearSearch` | 検索条件クリア | F1（一覧） |
| `mockAlert` | デバッグ用アラート | 任意 |

`defaultKeySpec.ts` の既定を画面の `keySpec` で上書き。

---

## 14. API クライアント

### `src/api/client.ts` の設計

- ネイティブ `fetch`（axios 不使用）
- `getAuthHeaders()` で Bearer トークンを付与
- `VITE_API_BASE_URL` 環境変数でベース URL を設定
- 400 は `ApiValidationError` で body を保持して throw

### 新しい API を追加する手順

1. リクエスト/レスポンス型を `client.ts` に追加
2. `fetch` 関数を追加（`createOrder` / `fetchOrders` をテンプレートに）
3. 400 対応が必要なら `ApiValidationError` を throw する分岐を追加
4. フィールドマッピング（`parseApiErrors` 用）を画面固有モジュールに定義

### API が未定（モック）の場合

Markdown で「（未定・モック）」と書かれている場合:
- マスタは `src/constants/mockData.ts` のモックデータを使う
- 保存は `alert('保存しました（モック）')` で仮実装
- API 確定後に差し替え可能な構造にしておく

---

## 15. バックエンド API 契約

### 共通ルール

| 項目 | 仕様 |
|---|---|
| Content-Type | `application/json` |
| 認証 | `Authorization: Bearer {token}` |
| 日付 | ISO 8601（`yyyy-MM-dd`） |
| 日時 | ISO 8601（`yyyy-MM-ddTHH:mm:ss`） |

### マスタ API

```
GET /api/masters/<name>
Response: [{ "code": "string", "name": "string" }]
```

### 登録 API

```
POST /api/<resource>
Request: { ヘッダ項目, lines: [明細項目] }
Response: { id, message }
```

### 一覧 API

```
GET /api/<resource>?params
Response: [フラット配列（1要素＝明細1行、ヘッダ項目は繰り返し）]
```

### 削除 API

```
DELETE /api/<resource>/{id}
Response: 204 No Content
```

### 400 エラーレスポンス

```json
{
  "code": "VALIDATION_ERROR",
  "message": "入力内容に誤りがあります",
  "details": [
    { "field": "contractPartyCode", "reason": "契約先コードは必須です" },
    { "field": "lines[0].productCode", "reason": "製品コードは必須です" }
  ]
}
```

- `VALIDATION_ERROR` + `details` 配列 → 各フィールドにエラー表示
- `BAD_REQUEST` + `details: []` → `message` をグローバルアラート表示
- `field` パス: ヘッダは DTO プロパティ名、明細は `lines[{index}].{field}`

---

## 16. 実装チェックリスト

### 登録画面

- [ ] `src/features/<screen>-screen/` ディレクトリを作成
- [ ] 行データ型を定義（`<screen>Types.ts`）
- [ ] 画面 Spec を定義（`<screen>NewSpec.ts`）
  - [ ] `headerFields` — Markdown のヘッダ表から変換
  - [ ] `navigationSpec` — ヘッダ表の行順 + 明細の編集○列
  - [ ] `keySpec` — Markdown の F キーから変換
  - [ ] `GridColumnValidation[]` — Markdown のバリデーション列から変換
- [ ] ColDef ビルダを作成（`<screen>Grid.ts`）
  - [ ] `resolveGridFieldTypePartial` でフィールド型を設定
  - [ ] 必要な `valueFormatter` / `valueParser` を追加
- [ ] CommitRule を定義（`<screen>CommitRules.ts`）
  - [ ] Markdown の「値確定ルール」を実装
- [ ] 行の初期化関数・追加関数・空行判定関数を作成
- [ ] ページ Vue を作成（`OrderNewPage.vue` をテンプレートに）
  - [ ] マスタ取得（`onMounted`）
  - [ ] `handleSave` でバリデーション → API
  - [ ] `handleNew` で初期化
  - [ ] `mergeColDefWithValidation` でエラー表示
  - [ ] `parseApiErrors` 用のフィールドマッピング
- [ ] ルートを追加
- [ ] `npm run build` で型エラーがないことを確認

### 一覧画面

- [ ] `ListScreenSpec` を定義
  - [ ] `searchFields` — Markdown の検索条件表から変換
  - [ ] `resultColumns` — Markdown の結果一覧表から変換（`format`, `spanRows`, `align`）
  - [ ] `searchAction` — 検索 API パス
  - [ ] `deleteAction` — 削除 API（Markdown に削除がなければ `null`）
  - [ ] `rowNavigation` — ダブルクリック遷移先
  - [ ] `searchParamMapping` — フィールド id と API パラメータ名が異なる場合
  - [ ] `keySpec` — 通常 `{ F1: 'clearSearch', F12: 'search' }`
- [ ] `listScreenSpecRegistry.ts` に登録
- [ ] `client.ts` に検索・削除関数を追加
- [ ] ルートを追加
- [ ] `npm run build` で型エラーがないことを確認
