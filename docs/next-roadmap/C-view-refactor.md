# C: ScreenWorkspaceView の分割

## 目的

現在の `ScreenWorkspaceView.vue` は受注・発注の 2 画面分のロジックが同居しており、画面が増えるたびに `v-if` 分岐と画面固有 ref が膨張する。一覧画面（B）を追加する前に分割し、**画面追加時に既存の Vue ファイルを編集する必要がない**構造にする。

---

## 現状の問題

`ScreenWorkspaceView.vue` の現状（約 300 行のスクリプト + テンプレート）：

| 問題 | 具体例 |
|------|--------|
| 画面ごとの `reactive` が並列管理 | `orderHeader` / `purchaseHeader` がそれぞれ独立した `reactive` |
| 画面ごとの行データが並列管理 | `orderRowData` / `purchaseRowData` がそれぞれ独立した `ref` |
| 画面ごとの GridApi が並列管理 | `gridApiOrder` / `gridApiPurchase` |
| テンプレートに `v-if` 分岐が散在 | `bundle.kind === 'order'` がテンプレート・スクリプト両方に複数箇所 |
| 画面固有の import が全画面分 | `orderNewSpec`, `purchaseNewSpec`, `orderCommitRules`, `purchaseCommitRules` 等すべてを import |
| `handleSave` に画面ごとの分岐 | `if (bundle.value.kind === 'order') { ... } else { ... }` |

**画面が 5 つになると維持不能**。3 画面目を追加するだけでも、上記すべてに手を入れる必要がある。

---

## 設計方針

### 3 層構造に分離する

```
┌─────────────────────────────────────────────┐
│  OrderNewPage.vue / PurchaseNewPage.vue     │  ← 画面ラッパー（画面固有）
│  ・画面固有の ref（header, rowData, gridApi）│
│  ・画面固有の API 呼び出し                   │
│  ・画面固有のハンドラ（handleSave 等）        │
├─────────────────────────────────────────────┤
│  RegistrationScreenShell.vue                │  ← 共通シェル（登録画面共通）
│  ・レイアウト（ヘッダ描画・グリッド枠）       │
│  ・F キー基盤                                │
│  ・aside（AI 助言パネル）                    │
│  ・ScreenHeaderField の v-for               │
│  ・AgGridVue の描画                          │
├─────────────────────────────────────────────┤
│  画面エンジン（useGridEnterNav 等）           │  ← 既存のまま
└─────────────────────────────────────────────┘
```

### 画面ラッパーの責務

各画面ラッパー（例: `OrderNewPage.vue`）は以下を持つ：

1. **画面固有の Spec**（`ORDER_NEW_SPEC` を import）
2. **画面固有の ref**（`orderHeader`, `orderRowData`, `gridApiOrder`）
3. **画面固有の API 呼び出し**（`createOrder`, `fetchParties`, `fetchProducts`）
4. **画面固有のハンドラ**（`handleNew`, `handleSave`）
5. **共通シェルに渡す props**:
   - `spec` — 画面の Spec
   - `header` — ヘッダの reactive データ
   - `rowData` — 行データの ref
   - `columnDefs` — 列定義（computed）
   - `onGridReady` — GridApi の取得コールバック
   - `onCellValueChanged` — セル値変更ハンドラ
   - `onCellEditingStopped` — 編集終了ハンドラ
   - `onNew` — 新規ハンドラ
   - `onSave` — 保存ハンドラ
   - `masterData` — マスタデータ（parties, products）

### 共通シェルの責務

`RegistrationScreenShell.vue` は以下を担う：

1. **レイアウト**（ヘッダバー、ヘッダカード、グリッドカード、aside）
2. **ScreenHeaderField の v-for 描画**（props の `spec.headerFields` を使用）
3. **AgGridVue の描画**（props の `columnDefs`, `rowData` 等を使用）
4. **F キー基盤**（`useKeySpec` を呼び、`onNew` / `onSave` を接続）
5. **ヘッダ Enter ナビゲーション**（`useHeaderEnterNav`）
6. **スタイル**（CSS は現在のものをそのまま移植）

### ルーティング

ルーティングはラッパーを直接指す：

```typescript
{
  path: '/orders/new',
  name: 'order-new',
  component: OrderNewPage,
  meta: { requiresAuth: true },
},
{
  path: '/purchase/new',
  name: 'purchase-new',
  component: PurchaseNewPage,
  meta: { requiresAuth: true },
},
```

`meta.screenSpecId` は不要になる（ラッパーが自分の Spec を知っている）。

---

## 作業手順

### ステップ 1: 共通シェルの props インターフェースを定義

**対象**: 新規ファイル `src/views/RegistrationScreenShell.vue`（最初は型定義だけ）

共通シェルが受け取る props を TypeScript の型として定義する。

```typescript
import type { ColDef, GridApi, GridReadyEvent, CellValueChangedEvent, CellEditingStoppedEvent } from 'ag-grid-community'
import type { HeaderFieldSpec, NavigationSpec, KeySpec } from '@/features/screen-engine/screenSpecTypes'
import type { CodeMasterItem } from '@/types/master'

export type RegistrationShellProps = {
  title: string
  gridHint: string
  headerFields: HeaderFieldSpec[]
  navigationSpec: NavigationSpec
  keySpec: KeySpec
  header: Record<string, unknown>
  rowData: unknown[]
  columnDefs: ColDef[]
  defaultColDef: ColDef
  getRowId: (params: { data: unknown }) => string
  parties: CodeMasterItem[]
  products: CodeMasterItem[]
}

export type RegistrationShellEmits = {
  gridReady: [event: GridReadyEvent]
  cellValueChanged: [event: CellValueChangedEvent]
  cellEditingStopped: [event: CellEditingStoppedEvent]
  new: []
  save: []
  headerUpdate: [fieldId: string, value: unknown]
  dateFocus: [field: HeaderFieldSpec]
}
```

**完了基準**:
- [ ] props の型が定義されている
- [ ] emits の型が定義されている

---

### ステップ 2: 共通シェル `RegistrationScreenShell.vue` を作成

**対象**: `src/views/RegistrationScreenShell.vue`

現在の `ScreenWorkspaceView.vue` から**画面固有のロジックを除いた部分**を移植する。

**移植する部分**:
- テンプレート全体（`<template>` の構造・CSS）
- `ScreenHeaderField` の `v-for` 描画
- `AgGridVue` の描画（1 つだけ。`v-if` 分岐は不要）
- `useHeaderEnterNav`
- `useKeySpec`（`onNew` / `onSave` は emits で親に委譲）
- aside パネル
- `popupParentEl` の管理
- `headerRefs` / `headerFieldRef` / `bindHeaderRef` のヘッダ ref 管理

**移植しない部分**（ラッパーに残す）:
- `orderHeader` / `purchaseHeader` — 画面固有
- `orderRowData` / `purchaseRowData` — 画面固有
- `gridApiOrder` / `gridApiPurchase` — 画面固有
- `orderNav` / `purchaseNav`（`useGridEnterNav`）— 画面固有
- `handleSave` の中身 — 画面固有
- `onOrderCellValueChanged` / `onPurchaseCellValueChanged` — 画面固有
- 列定義の computed — 画面固有
- マスタ API の fetch — 画面固有

**完了基準**:
- [ ] `RegistrationScreenShell.vue` が作成されている
- [ ] props で Spec・データ・ハンドラを受け取る
- [ ] テンプレートに `v-if` 分岐がない（1 つの AgGridVue だけ）
- [ ] `npm run build` が成功する（この時点ではまだルーティングは旧のまま）

---

### ステップ 3: `OrderNewPage.vue` を作成

**対象**: 新規ファイル `src/views/OrderNewPage.vue`

受注固有のロジックをラッパーに集約する。

**持つもの**:
- `ORDER_NEW_SPEC`（または `resolveOrderScreenSpec`）の import
- `orderHeader` の `reactive`
- `orderRowData` の `ref`
- `gridApiOrder` の `shallowRef`
- `useGridEnterNav` の呼び出し（受注用）
- `fetchParties` / `fetchProducts` の `onMounted`
- `handleNew` / `handleSave` の実装（現在の `ScreenWorkspaceView.vue` から移植）
- `onOrderCellValueChanged` の実装
- `orderColumnDefs` の `computed`

**テンプレート**:

```vue
<template>
  <RegistrationScreenShell
    :title="spec.title"
    :grid-hint="spec.gridHint"
    :header-fields="spec.headerFields"
    :navigation-spec="spec.navigationSpec"
    :key-spec="spec.keySpec"
    :header="orderHeader"
    :row-data="orderRowData"
    :column-defs="orderColumnDefs"
    :default-col-def="defaultColDef"
    :get-row-id="getRowId"
    :parties="parties"
    :products="products"
    @grid-ready="onGridReady"
    @cell-value-changed="onCellValueChanged"
    @cell-editing-stopped="onCellEditingStopped"
    @new="handleNew"
    @save="handleSave"
    @header-update="onHeaderUpdate"
    @date-focus="onDateFieldFocus"
  />
</template>
```

**完了基準**:
- [ ] `OrderNewPage.vue` が作成されている
- [ ] 受注固有のロジックがすべてここに集約されている
- [ ] `RegistrationScreenShell` を使って描画している

---

### ステップ 4: `PurchaseNewPage.vue` を作成

**対象**: 新規ファイル `src/views/PurchaseNewPage.vue`

発注固有のロジックをラッパーに集約する。構造は `OrderNewPage.vue` と同じ。

**完了基準**:
- [ ] `PurchaseNewPage.vue` が作成されている
- [ ] 発注固有のロジックがすべてここに集約されている

---

### ステップ 5: ルーティングを更新

**対象**: `src/router/index.ts`

```typescript
import OrderNewPage from '@/views/OrderNewPage.vue'
import PurchaseNewPage from '@/views/PurchaseNewPage.vue'

// 変更前:
// component: ScreenWorkspaceView, meta: { screenSpecId: 'order-new' }

// 変更後:
{ path: '/orders/new', name: 'order-new', component: OrderNewPage, meta: { requiresAuth: true } },
{ path: '/orders/new-alt', name: 'order-new-alt', component: OrderNewPage, meta: { requiresAuth: true, variant: 'alt' } },
{ path: '/purchase/new', name: 'purchase-new', component: PurchaseNewPage, meta: { requiresAuth: true } },
```

> **注意**: `order-new-alt` は `OrderNewPage` 内で `route.meta.variant` を見て Spec を切り替える。

**完了基準**:
- [ ] ルーティングがラッパーコンポーネントを直接指している
- [ ] `meta.screenSpecId` が不要になっている

---

### ステップ 6: `ScreenWorkspaceView.vue` を整理

**対象**: `src/views/ScreenWorkspaceView.vue`

分割完了後、`ScreenWorkspaceView.vue` は以下のいずれかにする：

- **案 A**: 削除する（ルーティングから参照されなくなるため）
- **案 B**: `RegistrationScreenShell.vue` の別名として残す（後方互換）

推奨は**案 A（削除）**。ただし、他の場所から import されていないことを確認すること。

**完了基準**:
- [ ] `ScreenWorkspaceView.vue` が削除されている（または空のラッパーに縮小されている）
- [ ] どこからも import されていない

---

### ステップ 7: `screenSpecRegistry.ts` の見直し

**対象**: `src/features/screen-engine/screenSpecRegistry.ts`

分割後、`resolveScreenBundle` の用途が変わる：

- ラッパーが直接 Spec を import するため、ルーティング時の動的解決は不要
- ただし、一覧画面（B）で「画面 ID → Spec」の解決が必要になる場合は残す

**判断**:
- B を同時進行する場合 → `resolveScreenBundle` を拡張して `ListScreenSpec` も含める
- B がまだの場合 → 使われなくなった `resolveScreenBundle` を整理（削除 or 将来用にコメント）

**完了基準**:
- [ ] 不要になったコードが整理されている
- [ ] `npm run build` が成功する

---

### ステップ 8: 結合テスト

**完了条件**:
- [ ] `/orders/new` で受注登録画面が従来どおり動作する
- [ ] `/orders/new-alt` で横展開サンプルが従来どおり動作する
- [ ] `/purchase/new` で発注登録画面が従来どおり動作する
- [ ] ヘッダの Enter ナビゲーションが動作する
- [ ] グリッドの Enter ナビゲーションが動作する
- [ ] F1（新規）、F12（保存）が動作する
- [ ] 画面ごとの Vue ファイルが分離されている
- [ ] 新しい画面を追加するとき、既存の Vue ファイルを編集する必要がない
- [ ] `npm run build` が成功する

---

## 参考ファイル

| ファイル | 役割 |
|---|---|
| `src/views/ScreenWorkspaceView.vue` | 分割対象（約 300 行） |
| `src/features/screen-engine/screenSpecRegistry.ts` | 登録の見直し対象 |
| `src/features/screen-engine/useGridEnterNav.ts` | ラッパーに移動する composable |
| `src/features/screen-engine/useHeaderEnterNav.ts` | シェルに残る composable |
| `src/features/screen-engine/useKeySpec.ts` | シェルに残る composable |
| `src/router/index.ts` | ルーティングの変更対象 |

---

## リスクと判断ポイント

| リスク | 対策 |
|---|---|
| シェルと ラッパーの props 境界が複雑になる | props の型を先に定義し（ステップ 1）、型安全を保証する |
| `order-new-alt` のバリアント切替 | ラッパー内で `route.meta.variant` を見て Spec を切り替える。シェルは関与しない |
| aside パネルの画面固有化 | 現時点ではダミーなのでシェルに固定。将来画面固有にする場合は slot で対応 |
| `useGridEnterNav` の `suppressEnterWhileEditing` が `defaultColDef` に渡される仕組み | ラッパーが `defaultColDef` を computed で組み立て、シェルに渡す |
