# A: 明細の疑似 2 段化

## 目的

AG Grid の 1 行に上下 2 段の項目を表示できるようにする。業務画面では 1 明細に 10〜15 項目が普通で、横並びだけでは収まらない。この機能により、限られた横幅で多くの項目を自然に配置できるようになる。

---

## 設計方針

`docs/screen-spec-plan.md` セクション 4 で決定済みの方針に従う：

1. **AG Grid の row は増やさない**（物理 1 行 = 論理 1 明細）
2. **セル描画（`cellRenderer`）で上下段を表現する** — セル内部で上段・下段の描画を行う
3. **Enter 移動は「見た目の段」ではなく「論理フィールド順」で制御する** — 既存の `editChainColIds` がそのまま使える
4. **段の情報は Spec で宣言する** — 列定義に `displayRow: 1 | 2` を追加し、描画側が解釈する

### Enter 移動の基本（`screen-spec-plan.md` セクション 4.2 より）

editable 順は以下（表示のみの項目は除外）：

```
製品コード → 数量 → 個別納期 → 備考 → 次明細の製品コード
```

2 段目の項目も `editChainColIds` の配列順で巡回するので、既存の `useGridEnterNav` の修正は不要。

---

## 前提知識：現状の仕組み

### 列定義の流れ

1. `orderNewSpec.ts` の `buildOrderColumnDefs()` が `ColDef[]` を生成
2. 各列に `editorRegistry.ts` の `resolveGridFieldTypePartial()` を呼び、field type に応じた ColDef 断片をマージ
3. `ScreenWorkspaceView.vue` の `computed` → `AgGridVue` の `:column-defs` に渡される

### Enter 移動の流れ

1. `useGridEnterNav` が `editChainColIds`（例: `['productCode', 'quantity', 'unitPrice']`）を受け取る
2. Enter で `stopEditing` → `onCellEditingStopped` で次の列 / 次の行に移動
3. 最終列の最終行なら新しい行を追加

### field type レジストリ（`editorRegistry.ts`）

現在のタイプ: `codeAutocomplete`, `numeric`, `text`, `readOnlyText`, `readOnlyComputed`

---

## 作業手順

### ステップ 1: Spec の型に `displayRow` を追加

**対象**: `src/features/screen-engine/screenSpecTypes.ts`

列定義で段を宣言するためのプロパティを追加する。

```typescript
export type GridColumnDisplayRow = 1 | 2

export type GridColumnSpec = {
  field: string
  headerName: string
  fieldType: GridFieldType
  displayRow?: GridColumnDisplayRow // 省略時は 1（上段）
  width?: number
  minWidth?: number
  pinned?: 'left' | 'right'
  // field type 固有のパラメータは fieldParams で渡す
  fieldParams?: Record<string, unknown>
}
```

> **注意**: これは列定義を Spec 側にリフトする型の追加であり、既存の `buildOrderColumnDefs()` の直接的な置き換えではない。まずは `displayRow` の型定義だけを追加し、既存コードと共存させる。

**完了基準**:
- [ ] `GridColumnDisplayRow` 型が `screenSpecTypes.ts` にエクスポートされている
- [ ] `npm run build` が成功する

---

### ステップ 2: 受注画面の Spec に 2 段目の列を追加

**対象**: `src/features/order-screen/orderNewSpec.ts`

受注画面の明細に「個別納期」「備考」列を追加し、2 段目に配置する。

```typescript
// editChainColIds に追加
const DEFAULT_GRID_EDIT_CHAIN = [
  'productCode', 'quantity', 'unitPrice',
  'individualDueDate', 'lineNote',  // 2段目
] as const

const DEFAULT_GRID_ENTER_STOP = [
  'quantity', 'unitPrice',
  'lineNote',  // 最終列を追加
] as const
```

`buildOrderColumnDefs()` に以下を追加：

| 列名 | field | fieldType | displayRow | 編集 |
|------|-------|-----------|------------|------|
| 個別納期 | `individualDueDate` | `text`（将来 `date` に変更可） | 2 | ○ |
| 備考 | `lineNote` | `text` | 2 | ○ |

`OrderLineRow` 型に `individualDueDate: string` と `lineNote: string` を追加する。

**完了基準**:
- [ ] 受注画面の列定義に `individualDueDate` と `lineNote` が含まれている
- [ ] `editChainColIds` で Enter が 2 段目の列も巡回する
- [ ] `OrderLineRow` に新フィールドが含まれ、初期値が空文字
- [ ] `npm run build` が成功する

---

### ステップ 3: 2 段表示用の `cellRenderer` を実装

**対象**: 新規ファイル `src/components/grid/TwoRowCellRenderer.vue`（または `.ts`）

1 つのセル内に上段と下段の値を描画するカスタム `cellRenderer` を作成する。

**描画イメージ**:

```
┌────────────────┐
│ 上段の値        │  ← displayRow: 1 のフィールド値
│ 下段の値        │  ← displayRow: 2 のフィールド値
└────────────────┘
```

**設計ポイント**:

- `cellRendererParams` で上段・下段のフィールド名とラベルを受け取る
- 上段と下段を `div` で縦に並べ、フォントサイズは既存セルと揃える
- 編集時（`cellEditor`）は該当フィールドの単一値を普通に編集する（レンダラは表示専用）
- 編集が始まると AG Grid がセルを cellEditor に切り替えるので、2 段表示は一時的に消える（AG Grid の標準動作）

**完了基準**:
- [ ] `TwoRowCellRenderer` コンポーネントが作成されている
- [ ] 上段・下段の値が描画される
- [ ] 編集モードへの遷移が正常に動作する

---

### ステップ 4: `editorRegistry` に 2 段表示用 field type を追加

**対象**: `src/features/screen-engine/editorRegistry.ts`

```typescript
export const GRID_FIELD_TYPES = [
  'codeAutocomplete',
  'numeric',
  'text',
  'readOnlyText',
  'readOnlyComputed',
  'twoRowDisplay',  // 追加
] as const
```

`resolveGridFieldTypePartial()` に `twoRowDisplay` ケースを追加し、`cellRenderer: TwoRowCellRenderer` を返す。

> **注意**: 2 段表示は「表示方法」の問題であり、「入力方法」は別の field type（`text`, `numeric` 等）のまま。実装方法として以下の 2 案がある：
>
> - **案 A**: `twoRowDisplay` を独立した field type にし、セル描画時に上下段を表示する
> - **案 B**: 既存の field type に `displayRow` オプションを追加し、`cellRenderer` を差し込む
>
> Phase A では案 A（独立 type）でシンプルに始め、必要に応じて案 B にリファクタする。

**完了基準**:
- [ ] `twoRowDisplay` が `GRID_FIELD_TYPES` に含まれている
- [ ] `resolveGridFieldTypePartial()` が `twoRowDisplay` を解決できる
- [ ] `npm run build` が成功する

---

### ステップ 5: `rowHeight` を 2 段分に広げる

**対象**: `src/views/ScreenWorkspaceView.vue`（または共通シェル）

2 段表示がある画面では、AG Grid の `rowHeight` を通常より高くする必要がある。

**実装方針**:

- Spec（または列定義）に `displayRow: 2` の列が 1 つでもあれば、`rowHeight` を 2 段分（例: 48px → 72px）に広げる
- `AgGridVue` の `:row-height` props に動的にバインドする
- 将来的には Spec に `gridRowHeight` のような設定を持たせることも検討する

**完了基準**:
- [ ] 2 段表示のある画面で行の高さが適切に広がっている
- [ ] 1 段のみの画面（発注デモ等）は従来の行高さのまま
- [ ] `npm run build` が成功する

---

### ステップ 6: Markdown 画面定義に「段」の書き方を追加

**対象**: `docs/screen-engine-roadmap/phase4.md`（テンプレート部分）

明細グリッドの表に「段」列を追加する。

```markdown
### 明細グリッド

| 列名 | 型 | 編集 | 段 | 備考 |
|------|-----|------|-----|------|
| 製品コード | コード選択 | ○ | 1 | |
| 数量 | 数値 | ○ | 1 | |
| 個別納期 | テキスト | ○ | 2 | |
| 備考 | テキスト | ○ | 2 | |
```

語彙対応表にも追加：

| 人間が書く表現 | AI が解釈する displayRow |
|---|---|
| 1, 上段, 上, （省略） | `displayRow: 1` |
| 2, 下段, 下 | `displayRow: 2` |

**完了基準**:
- [ ] `phase4.md` のテンプレートに「段」列の説明がある
- [ ] `docs/screen-specs/order-new.md` に 2 段目の列定義が追加されている

---

### ステップ 7: 結合テスト

すべてのステップが完了した後、以下を確認する。

**完了基準**:
- [ ] 受注画面の明細に 2 段目の項目（個別納期・備考）が表示される
- [ ] Enter で論理フィールド順（`productCode` → `quantity` → `unitPrice` → `individualDueDate` → `lineNote` → 次行の `productCode`）に巡回する
- [ ] Spec の `displayRow` を変更するだけで段の割り当てを切り替えられる
- [ ] 発注画面（2 段なし）は従来どおり動作する
- [ ] `npm run build` が成功する

---

## 参考ファイル

| ファイル | 役割 |
|---|---|
| `docs/screen-spec-plan.md` セクション 4 | 疑似 2 段の設計方針 |
| `src/features/screen-engine/editorRegistry.ts` | field type の追加先 |
| `src/features/screen-engine/useGridEnterNav.ts` | Enter 移動（修正不要であることを確認） |
| `src/features/order-screen/orderNewSpec.ts` | 列定義の変更先 |
| `src/features/screen-engine/screenSpecTypes.ts` | Spec 型定義の追加先 |

---

## リスクと判断ポイント

| リスク | 対策 |
|---|---|
| 2 段表示でセルの編集 UX が変わる | 編集時は通常セルに切り替わる（AG Grid の標準動作）。違和感があれば `cellEditorPopup` で対応 |
| `rowHeight` 固定だと 1 段と 2 段の混在が難しい | 将来的に `getRowHeight` コールバックで行ごとに高さを変える拡張が可能 |
| 2 段目の列幅調整が複雑 | 上段と下段で異なる列幅が必要な場合は、`cellRenderer` 内で独自にレイアウトする |
