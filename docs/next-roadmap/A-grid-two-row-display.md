# A: 明細の疑似 2 段化

> **ステータス: 先送り・要再検討**
>
> AG Grid の仕様調査の結果、1 行内に疑似 2 段を実現するにはツールの設計思想に逆らう力技が必要で、実装が複雑になることが判明した。現時点では具体的な画面要件（何列の画面で横幅がどれだけ不足するか）が確定していないため、**具体的な画面イメージが出てきた段階で方式を再検討する**こととし、本フェーズは一旦先送りとする。

---

## 目的

AG Grid の 1 行に上下 2 段の項目を表示できるようにする。業務画面では 1 明細に 10〜15 項目が普通で、横並びだけでは収まらない。この機能により、限られた横幅で多くの項目を自然に配置できるようになる。

---

## 横幅不足に対する代替アプローチ（再検討時の選択肢）

疑似 2 段の本質的な目的は**横幅不足の解決**である。2 段化はその手段の一つに過ぎない。具体的な画面要件が出てきた際に、以下の選択肢から最適なものを選ぶ。

### 案 1: 横一列のまま、列をコンパクトにする

- 列幅を業務的に必要な最小幅に詰める（数量: 70px、単価: 80px 等）
- 長い列（製品名等）は `tooltipValueGetter` でホバー表示にして列幅を縮める
- AG Grid の標準機能（水平スクロール、`pinned: 'left'` での列固定）で対応

**メリット**: AG Grid の設計にそのまま乗る。追加実装ゼロ。Enter ナビも既存のまま。
**デメリット**: 15 列になると右端が見切れる。スクロールが必要。

### 案 2: 横一列 + 重要度で列を分類

- 主要列（製品コード、数量、単価、金額）は常時表示
- 補助列（個別納期、備考、商品分類）は右端に置いてスクロールで到達
- `pinned: 'left'` で行番号と製品コードを固定

**メリット**: 案 1 と同じくゼロ実装。「よく見る列」と「たまに見る列」を分ければ、スクロールしても業務に支障がないケースが多い。
**デメリット**: 全列を一覧したい場面では不便。

### 案 3: 行クリックで詳細パネルを開く

- グリッドは主要列のみ（5〜6 列）
- 行をクリック（または Enter）すると、グリッド下部 or サイドに詳細入力パネルが出る
- 詳細パネルにフォームレイアウトで補助項目を並べる

**メリット**: グリッドは軽い。補助項目はフォームなので自由にレイアウトできる。AG Grid に逆らわない。
**デメリット**: 視線移動が増える。明細をざっと見渡すときに詳細が見えない。

### 案 4: AG Grid の Master/Detail を使う

- 行を展開すると個別納期・備考等の詳細が下に開く
- ただし Master/Detail は **Enterprise 機能**（有償ライセンスが必要）

**メリット**: AG Grid 公式のパターン。
**デメリット**: Enterprise ライセンスが必要。常に展開しておく運用はやや不自然。

### 案 5: 疑似 2 段を進める（本ドキュメント後半の方式 C）

**メリット**: オフコン画面の再現度が高い。
**デメリット**: AG Grid の設計思想に逆らう力技。cellRenderer + CSS オーバーライド + Column Group + rowHeight 調整が必要で、実装・保守コストが高い。

### 選定の判断基準

| 判断材料 | 推奨する案 |
|----------|-----------|
| 補助項目は入力するが、一覧でザッと見る必要はあまりない | **案 1 or 案 2**（ゼロ実装で十分） |
| 全項目を一覧で見ながら入力する業務がある | **案 3**（詳細パネル） |
| オフコンの 2 段レイアウトを忠実に再現する必要がある | **案 5**（覚悟の上で疑似 2 段） |

> **補足**: オフコン画面が 2 段だったのは、80×24 のターミナル画面に収めるための制約であり、ブラウザ画面で同じ制約はない。横スクロール・ツールチップ・詳細パネルが使えるブラウザでは、無理に 2 段にしなくても解決できるケースが多い。

---

## 以下、方式 C（疑似 2 段）の技術設計（参考）

> 以下は、案 5（疑似 2 段）を選択した場合の技術設計資料として残す。再検討時に方式 C を採用する場合はこのまま使える。他の案を採用する場合は不要。

---

## AG Grid の仕様制約（技術調査結果）

本設計を策定するにあたり、AG Grid v35 の以下の仕様を確認した。

### 1. 列とフィールドの 1:1 関係

AG Grid の基本モデルは **1 列 = 1 `field`**。ColDef の `field` は 1 つの文字列で、`getValue` / `setValue` はその 1 フィールドに対して動作する。

**制約**: 「数量列の下に個別納期を表示する」場合、AG Grid から見ると「数量列」のフィールドは `quantity` 1 つ。`individualDueDate` は別のフィールドであり、AG Grid の標準的な編集フロー（`startEditingCell` → `cellEditor.getValue()` → `onCellValueChanged`）には乗らない。

### 2. cellRenderer と cellEditor の排他的切替

AG Grid はセルが編集モードに入ると、`cellRenderer` を DOM から外して `cellEditor` に置き換える。

**制約**: 2 段表示の `cellRenderer` で「上段: 数量、下段: 個別納期」を描画していても、編集モードに入ると cellRenderer ごと消える。AG Grid 標準の `cellEditor` は 1 つの値しか返せない（`getValue()` は単一値を返す API）。

### 3. cellRenderer から行データへの読み取りアクセス

`cellRenderer` は `params.data` 経由で**行データの全フィールド**に読み取りアクセスできる。つまり、数量列の `cellRenderer` 内から `params.data.individualDueDate` を読むことは可能。

**活用**: 表示（`cellRenderer`）では同一行の複数フィールドを自由に描画できる。問題は編集フローのみ。

### 4. node.setDataValue による他フィールド更新

`cellEditor` 内から `params.node.setDataValue(field, value)` を呼べば、同一行の他フィールドを更新できる。ただし、これを呼ぶと行全体が再描画されるため、**編集中のセルのフォーカスが外れる**リスクがある。

**活用**: `cellEditor` の `getValue()` 完了後（編集終了後）に `setDataValue` で副フィールドを更新する方式なら、フォーカス問題は回避できる。

### 5. rowHeight と getRowHeight

- `rowHeight`: 全行一律の高さ
- `getRowHeight(params)`: 行ごとに異なる高さを返すコールバック
- `api.resetRowHeights()`: 全行の高さを再計算

**活用**: 2 段表示の画面では `rowHeight` を一律で広げる（例: 72px）のが最もシンプル。

### 6. cellEditorPopup

`cellEditorPopup: true` を設定すると、cellEditor がセル内ではなく**ポップアップとして表示**される。ポップアップ内に複数入力を配置できる。

**活用**: 2 フィールドを編集するカスタムエディタを popup 表示にすれば、セルの高さに制約されない。

---

## 実現方式の選定

AG Grid の仕様制約を踏まえ、以下の 3 方式を検討した。

### 方式 A: 独立列 + cellRenderer で段ずらし表示

**概要**: `individualDueDate` と `lineNote` を独立した AG Grid 列として追加。各列の `cellRenderer` で `displayRow` に応じて上段 or 下段に値を描画する。

**メリット**: AG Grid の 1 列 = 1 フィールドを保ち、標準の編集フロー（`cellEditor` → `getValue`）がそのまま使える。`useGridEnterNav` の `editChainColIds` に追加するだけで Enter ナビゲーションが動く。

**デメリット**: 見た目上、1 つのセル幅に対して上段 or 下段のどちらかしか使わないため、半分が空白になる。横幅が余る。

**判定**: **見た目がぎこちない**。疑似 2 段の目的（横幅の節約）と矛盾する。

### 方式 B: ブロック列（1 列に 2 フィールドを詰め込む）

**概要**: 数量 + 個別納期を 1 つの「ブロック列」にし、カスタム cellRenderer（2 段表示）+ カスタム cellEditor（2 入力）で実装する。

**メリット**: 見た目がきれい（上段: 数量、下段: 個別納期）。横幅を効率的に使える。

**デメリット**: AG Grid の 1 列 = 1 フィールドの原則を破る。`getValue()` が 1 値しか返せないため、副フィールドは cellEditor 内で `node.setDataValue` する必要がある。`useGridEnterNav` をバイパスし、Enter ナビゲーションを cellEditor 内で独自実装する必要がある。実装が複雑で、画面エンジンの「Spec で宣言的に制御する」設計思想に反する。

**判定**: **実装は可能だが、エンジン汎用性が損なわれる**。

### 方式 C: 独立列 + 列グループヘッダ + cellRenderer 二段描画（採用）

**概要**: AG Grid の**列グループ（Column Groups）**を活用する。物理的には独立した列だが、視覚的に関連する上段・下段の列をペアとして扱う。

具体的には:

1. `quantity` と `individualDueDate` は独立した ColDef（各列に `field` が 1:1 対応）
2. 両者を AG Grid の Column Group でまとめ、グループヘッダを表示
3. 各セルの `cellRenderer` は `displayRow` に応じて**セル全高の上半分 or 下半分に値を描画**する
4. `rowHeight` を 2 段分（例: 72px）に広げ、上段セルは上半分に、下段セルは下半分に描画する
5. 編集は AG Grid 標準の `cellEditor` がそのまま使える（1 列 = 1 フィールド）
6. Enter ナビゲーションは `editChainColIds` に論理順で列を並べるだけ

**メリット**:
- AG Grid の 1 列 = 1 フィールドを完全に保つ
- 標準の `cellEditor` → `getValue()` → `onCellValueChanged` フローが動く
- `useGridEnterNav` の `editChainColIds` に追加するだけで Enter が巡回する
- `cellRenderer` だけがカスタム（編集は標準）で、実装量が最小
- Spec に `displayRow: 1 | 2` を追加するだけで宣言的に制御できる

**デメリット**:
- 列ヘッダが 2 段分の情報を持つことになる（Column Group で対処）
- 上段列と下段列が横方向に別セルとして並ぶため、列幅を揃える CSS 調整が必要
- 編集モード時に cellRenderer が消えるため、上段 or 下段の位置情報がなくなる → 編集中のセルが全高を使う（AG Grid 標準動作で、これは許容する）

**判定**: **AG Grid の設計に最も適合し、エンジンの宣言的制御を維持できる。採用。**

---

## 方式 C の詳細設計

### 列の配置イメージ

```
AG Grid の物理列構成:

[行番号] [製品コード] [製品名] [数量      ] [個別納期   ] [単価      ] [備考      ] [金額]
pinned                          displayRow:1  displayRow:2  displayRow:1  displayRow:2
                                ←  グループ →               ←  グループ →
```

`rowHeight: 72px` にすると、各セルの描画エリアが 72px になる。
- `displayRow: 1` の cellRenderer → セルの上半分（36px）に値を描画
- `displayRow: 2` の cellRenderer → セルの下半分（36px）に値を描画

**見た目のイメージ**:

```
┌──┬──────────┬──────────┬──────────────────────┬──────────────────────┬──────┐
│行│ 製品コード│  製品名  │ 数量    │ 個別納期   │ 単価     │ 備考     │ 金額 │
├──┼──────────┼──────────┼─────────┼────────────┼──────────┼──────────┼──────┤
│ 1│ B001     │ ﾘﾁｳﾑｾﾙL型│  100    │ 2026-04-10 │  1,500   │ 急ぎ     │150000│
│  │          │          │─ ─ ─ ─ ─│─ ─ ─ ─ ─ ─ │─ ─ ─ ─ ─│─ ─ ─ ─ ─│      │
├──┼──────────┼──────────┼─────────┼────────────┼──────────┼──────────┼──────┤
│ 2│ B004     │ AGMﾊﾞｯﾃﾘｰ│   50    │            │  3,200   │          │160000│
│  │          │          │         │            │          │          │      │
└──┴──────────┴──────────┴─────────┴────────────┴──────────┴──────────┴──────┘
```

上段列（数量・単価）と下段列（個別納期・備考）が物理的に隣り合うが、cellRenderer が上半分 or 下半分に描画するため、視覚的に 2 段に見える。

### Column Group の利用

AG Grid の Column Group で上段・下段のペアを視覚的にまとめる:

```typescript
const columnDefs: ColDef[] = [
  { headerName: '行', field: 'lineNo', ... },
  { headerName: '製品コード', field: 'productCode', ... },
  { headerName: '製品名', field: 'productName', ... },
  {
    headerName: '数量/個別納期',
    children: [
      { headerName: '数量', field: 'quantity', displayRow: 1, ... },
      { headerName: '個別納期', field: 'individualDueDate', displayRow: 2, ... },
    ],
  },
  {
    headerName: '単価/備考',
    children: [
      { headerName: '単価', field: 'unitPrice', displayRow: 1, ... },
      { headerName: '備考', field: 'lineNote', displayRow: 2, ... },
    ],
  },
  { headerName: '金額', field: 'amount', ... },
]
```

> **Column Group のポイント**: AG Grid は `children` を持つ ColDef を列グループとして扱う。グループヘッダが上部に表示され、子列のヘッダはその下に表示される。グループ名でペアの関連性が明確になる。

### TwoRowCellRenderer の動作

`displayRow: 1`（上段）の場合:
- セルの上半分に値を描画（`padding-top` で位置調整、下半分は空白または薄い区切り線）

`displayRow: 2`（下段）の場合:
- セルの下半分に値を描画（`padding-top` で上半分を空け、下半分に値を配置）

1 段のみの列（行番号、製品コード、製品名、金額）:
- `displayRow` 未指定 → cellRenderer なし（AG Grid デフォルト描画）。`rowHeight: 72px` の中で `line-height` で垂直中央揃え

### 編集時の挙動

編集モードに入ると:
1. AG Grid が cellRenderer を DOM から除去し、cellEditor に切り替える
2. cellEditor はセル全高（72px）を使って表示される
3. 上段・下段の位置情報は失われるが、1 フィールドの編集なので問題ない
4. 編集完了後、cellRenderer が再描画され、上段 or 下段に値が戻る

**これは AG Grid の標準動作であり、カスタムの cellEditor は不要。**

### Enter ナビゲーション

`editChainColIds` に論理順で列 ID を並べるだけ:

```typescript
const DEFAULT_GRID_EDIT_CHAIN = [
  'productCode',
  'quantity',          // 上段
  'individualDueDate', // 下段（数量の下）
  'unitPrice',         // 上段
  'lineNote',          // 下段（単価の下）
] as const
```

既存の `useGridEnterNav` はそのまま動く。追加実装不要。

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

```typescript
export type GridColumnDisplayRow = 1 | 2
```

この型は後続ステップで列定義に使用する。既存の型には影響しない。

**完了基準**:
- [ ] `GridColumnDisplayRow` 型が `screenSpecTypes.ts` にエクスポートされている
- [ ] `npm run build` が成功する

---

### ステップ 2: `TwoRowCellRenderer` を実装

**対象**: 新規ファイル `src/components/grid/TwoRowCellRenderer.vue`

セル内で上半分 or 下半分に値を描画する cellRenderer。

```vue
<script setup lang="ts">
import { computed } from 'vue'
import type { ICellRendererParams } from 'ag-grid-community'

export type TwoRowCellRendererParams = {
  displayRow: 1 | 2
}

const props = defineProps<{
  params: ICellRendererParams & TwoRowCellRendererParams
}>()

const displayRow = computed(() => props.params.displayRow ?? 1)

function displayText(): string {
  if (props.params.valueFormatted != null && props.params.valueFormatted !== '') {
    return String(props.params.valueFormatted)
  }
  const v = props.params.value
  if (v == null || v === '') return ''
  return String(v)
}

defineExpose({
  refresh(): boolean {
    return true
  },
})
</script>

<template>
  <div class="two-row-cell" :class="`two-row-cell--row-${displayRow}`">
    <span class="two-row-cell__value">{{ displayText() }}</span>
  </div>
</template>

<style scoped>
.two-row-cell {
  display: flex;
  align-items: center;
  width: 100%;
  height: 50%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.two-row-cell--row-1 {
  /* 上半分に配置 */
  align-self: flex-start;
}
.two-row-cell--row-2 {
  /* 下半分に配置 */
  align-self: flex-end;
}
</style>
```

**設計ポイント**:
- cellRenderer は**表示のみ**を担当。編集は AG Grid 標準の cellEditor に任せる
- `params.data` にはアクセスしない（自列の `params.value` / `params.valueFormatted` だけ使う）
- `refresh()` は `true` を返し、AG Grid に再利用可能であることを伝える

**注意**: 上記は設計サンプル。CSS の `height: 50%` / `align-self` が AG Grid のセル DOM 構造で正しく動作するかは実装時に検証が必要。`.ag-cell-wrapper` に `display: flex; flex-direction: column; height: 100%` を強制する CSS オーバーライドが必要になる可能性がある（ステップ 5 で対応）。

**完了基準**:
- [ ] `TwoRowCellRenderer.vue` が作成されている
- [ ] `displayRow: 1` で上半分に、`displayRow: 2` で下半分に値が描画される
- [ ] 編集モードへの遷移が正常に動作する（cellRenderer が消えて cellEditor に切り替わる）

---

### ステップ 3: `editorRegistry` に `twoRowDisplay` field type を追加

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

`resolveGridFieldTypePartial()` に `twoRowDisplay` ケースを追加:

```typescript
case 'twoRowDisplay':
  return {
    cellRenderer: TwoRowCellRenderer,
    cellRendererParams: { displayRow: input.params.displayRow },
  }
```

**重要**: `twoRowDisplay` は**表示方法だけ**を変更する。`editable` や `cellEditor` は設定しない。これにより、呼び出し側で別の field type（`numeric`, `text` 等）のパーシャルと**組み合わせて使える**:

```typescript
{
  field: 'quantity',
  ...resolveGridFieldTypePartial({ fieldType: 'numeric' }),        // editable: true, valueParser 等
  ...resolveGridFieldTypePartial({ fieldType: 'twoRowDisplay',     // cellRenderer のみ上書き
                                    params: { displayRow: 1 } }),
}
```

**スプレッド順序の注意**: `twoRowDisplay` を**後に**スプレッドすることで、`cellRenderer` だけが上書きされる。`editable`, `cellEditor`, `valueParser` 等は先にスプレッドした field type のものが残る。

**完了基準**:
- [ ] `twoRowDisplay` が `GRID_FIELD_TYPES` に含まれている
- [ ] `resolveGridFieldTypePartial()` が `twoRowDisplay` を解決でき、`cellRenderer` のみ返す
- [ ] `npm run build` が成功する

---

### ステップ 4: 受注画面の Spec に 2 段目の列を追加

**対象**: `src/features/order-screen/orderNewSpec.ts`, `src/types/order.ts`

#### 4a. `OrderLine` 型にフィールドを追加

```typescript
export type OrderLine = {
  productCode: string
  productName: string
  quantity: number
  unitPrice: number
  amount: number
  individualDueDate: string  // 追加
  lineNote: string           // 追加
}
```

#### 4b. 列定義に Column Group を使用

```typescript
function buildOrderColumnDefs(products: readonly CodeMasterItem[]): (ColDef | ColGroupDef)[] {
  return [
    { headerName: '行', field: 'lineNo', width: 52, pinned: 'left', ... },
    { headerName: '製品コード', field: 'productCode', width: 200, ... },
    { headerName: '製品名', field: 'productName', width: 220, ... },
    {
      headerName: '数量/個別納期',
      children: [
        {
          headerName: '数量', field: 'quantity', width: 100,
          ...resolveGridFieldTypePartial({ fieldType: 'numeric' }),
          ...resolveGridFieldTypePartial({ fieldType: 'twoRowDisplay', params: { displayRow: 1 } }),
        },
        {
          headerName: '個別納期', field: 'individualDueDate', width: 100,
          ...resolveGridFieldTypePartial({ fieldType: 'text' }),
          ...resolveGridFieldTypePartial({ fieldType: 'twoRowDisplay', params: { displayRow: 2 } }),
        },
      ],
    },
    {
      headerName: '単価/備考',
      children: [
        {
          headerName: '単価', field: 'unitPrice', width: 100,
          ...resolveGridFieldTypePartial({ fieldType: 'numeric' }),
          ...resolveGridFieldTypePartial({ fieldType: 'twoRowDisplay', params: { displayRow: 1 } }),
        },
        {
          headerName: '備考', field: 'lineNote', width: 140,
          ...resolveGridFieldTypePartial({ fieldType: 'text' }),
          ...resolveGridFieldTypePartial({ fieldType: 'twoRowDisplay', params: { displayRow: 2 } }),
        },
      ],
    },
    { headerName: '金額', field: 'amount', width: 112, ... },
  ]
}
```

#### 4c. Enter チェーンの更新

```typescript
const DEFAULT_GRID_EDIT_CHAIN = [
  'productCode',
  'quantity',
  'individualDueDate',
  'unitPrice',
  'lineNote',
] as const

const DEFAULT_GRID_ENTER_STOP = [
  'quantity',
  'individualDueDate',
  'unitPrice',
  'lineNote',
] as const
```

#### 4d. 行データの初期値

```typescript
export function createEmptyOrderRows(): OrderLineRow[] {
  return Array.from({ length: INITIAL_ROWS }, (_, i) => ({
    lineNo: i + 1,
    productCode: '',
    productName: '',
    quantity: 0,
    unitPrice: 0,
    amount: 0,
    individualDueDate: '',
    lineNote: '',
  }))
}
```

**完了基準**:
- [ ] `OrderLine` 型に `individualDueDate` と `lineNote` が含まれている
- [ ] 列定義で Column Group が使われている
- [ ] `editChainColIds` が論理順で全編集可能列を含んでいる
- [ ] 行データの初期値に新フィールドが含まれている
- [ ] `npm run build` が成功する

---

### ステップ 5: `rowHeight` を 2 段分に広げる + CSS 調整

**対象**: `src/views/ScreenWorkspaceView.vue`

#### 5a. rowHeight の設定

`AgGridVue` に `:row-height="72"` を設定する（受注画面のみ。発注画面は従来のまま）。

方法: `bundle.kind === 'order'` のときのみ `rowHeight` を上書きする。

```vue
<AgGridVue
  v-if="bundle.kind === 'order'"
  :row-height="72"
  ...
/>
```

#### 5b. CSS オーバーライド

AG Grid のデフォルトでは `.ag-cell-wrapper` が `align-items: center` で、セル内コンテンツが垂直中央に配置される。2 段表示では `TwoRowCellRenderer` がセル全高を使えるように調整が必要。

```css
/* 2 段表示用: セルラッパーを全高に伸ばす */
.grid-wrap--two-row :deep(.ag-cell-wrapper) {
  align-items: stretch;
  height: 100%;
}
.grid-wrap--two-row :deep(.ag-cell-value) {
  display: flex;
  flex-direction: column;
  height: 100%;
}
```

> **検証ポイント**: AG Grid v35 のセル DOM 構造は `.ag-cell` > `.ag-cell-wrapper` > `.ag-cell-value` > (cellRenderer)。この構造が想定と異なる場合は CSS セレクタを調整する。ブラウザの DevTools で実際の DOM を確認すること。

#### 5c. 1 段のみの列の表示

2 段表示を使わない列（行番号、製品コード、製品名、金額）は cellRenderer を設定しない。`rowHeight: 72px` のセル内で AG Grid デフォルトの描画が行われる。テキストは垂直中央揃えになるが、高さが余るだけなので問題ない。

**完了基準**:
- [ ] 受注画面で行の高さが 72px になっている
- [ ] `TwoRowCellRenderer` がセル全高を使って上半分 or 下半分に描画できている
- [ ] 1 段のみの列が正常に表示されている
- [ ] 発注画面は従来の行高さのまま
- [ ] `npm run build` が成功する

---

### ステップ 6: Column Group ヘッダの表示調整

**対象**: `src/views/ScreenWorkspaceView.vue` または CSS

Column Group を使うと AG Grid がグループヘッダ行を追加する。これが画面の見た目に合うか確認し、必要に応じて調整する。

**検証ポイント**:
- グループヘッダ（「数量/個別納期」「単価/備考」）の表示が自然か
- グループヘッダが不要な場合は `headerGroupComponent` で非表示にできる
- または Column Group を使わず、単に列を並べて `headerName` で区別する方式に切り替えてもよい

> **判断基準**: Column Group のヘッダが業務画面の見た目に合わない場合は、Column Group を外して単純な列の並びにする。この場合でも cellRenderer の `displayRow` 表示は問題なく動作する。

**完了基準**:
- [ ] ヘッダ表示が自然で、ユーザが上段・下段の関連性を理解できる
- [ ] 必要に応じてグループヘッダの表示を調整済み

---

### ステップ 7: Markdown 画面定義に「段」の書き方を追加

**対象**: `docs/archive/screen-engine-roadmap/phase4.md`

明細グリッドの表に「段」列を追加する。

```markdown
### 明細グリッド

| 列名 | 型 | 編集 | 段 | 備考 |
|------|-----|------|-----|------|
| 製品コード | コード選択 | ○ | 1 | |
| 数量 | 数値 | ○ | 1 | |
| 個別納期 | テキスト | ○ | 2 | 数量とグループ |
| 単価 | 数値 | ○ | 1 | |
| 備考 | テキスト | ○ | 2 | 単価とグループ |
```

語彙対応表にも追加:

| 人間が書く表現 | AI が解釈する displayRow |
|---|---|
| 1, 上段, 上,（省略） | `displayRow: 1` |
| 2, 下段, 下 | `displayRow: 2` |

**完了基準**:
- [ ] `phase4.md` のテンプレートに「段」列の説明がある
- [ ] `docs/screen-specs/order-new.md` に 2 段目の列定義が追加されている

---

### ステップ 8: 結合テスト

すべてのステップが完了した後、以下を確認する。

**完了条件**:
- [ ] 受注画面の明細に 2 段目の項目（個別納期・備考）が表示される
- [ ] 上段の列（数量・単価）の値がセルの上半分に表示される
- [ ] 下段の列（個別納期・備考）の値がセルの下半分に表示される
- [ ] 上段・下段どちらのセルもクリックまたは Enter で編集モードに入れる
- [ ] 編集完了後、値が正しく反映される
- [ ] Enter で論理フィールド順（`productCode` → `quantity` → `individualDueDate` → `unitPrice` → `lineNote` → 次行の `productCode`）に巡回する
- [ ] 最終行の最終編集列（`lineNote`）で Enter → 新しい行を追加し、`productCode` にフォーカス
- [ ] 発注画面（2 段なし）は従来どおり動作する
- [ ] `npm run build` が成功する

---

## 参考ファイル

| ファイル | 役割 |
|---|---|
| `docs/screen-spec-plan.md` セクション 4 | 疑似 2 段の設計方針（原案） |
| `src/features/screen-engine/editorRegistry.ts` | field type の追加先 |
| `src/features/screen-engine/useGridEnterNav.ts` | Enter 移動（**修正不要**であることを確認） |
| `src/features/order-screen/orderNewSpec.ts` | 列定義の変更先 |
| `src/features/screen-engine/screenSpecTypes.ts` | Spec 型定義の追加先 |
| `src/views/ScreenWorkspaceView.vue` | rowHeight と CSS の変更先 |

---

## AG Grid 公式リファレンス（実装時に参照）

| 機能 | URL |
|------|-----|
| Row Height / getRowHeight | https://www.ag-grid.com/vue-data-grid/row-height/ |
| Cell Components（cellRenderer） | https://www.ag-grid.com/vue-data-grid/component-cell-renderer/ |
| Column Groups | https://www.ag-grid.com/vue-data-grid/column-groups/ |
| Edit Components（cellEditor） | https://www.ag-grid.com/vue-data-grid/cell-editors/ |

---

## リスクと判断ポイント

| リスク | 対策 |
|---|---|
| CSS オーバーライドが AG Grid のバージョンアップで壊れる | `.ag-cell-wrapper` / `.ag-cell-value` のセレクタは AG Grid の内部構造に依存する。バージョンアップ時に検証が必要 |
| Column Group ヘッダが画面デザインに合わない | ステップ 6 で検証し、合わなければグループを外して単純な列並びにする。cellRenderer の動作には影響しない |
| 編集モード時に上段・下段の位置情報が消える | AG Grid の標準動作として許容する。cellEditor がセル全高を使うのは一般的な UX |
| 上段・下段の列幅が異なると見た目がずれる | Column Group 内の列幅を揃えるか、CSS で調整する |
| 将来的に 3 段以上が必要になる | `displayRow: 1 | 2 | 3` に拡張し、cellRenderer の `height: 33%` にすればよい |

---

## 旧方式（ブロック列）との比較

前回の実装で試みた「ブロック列方式」を廃止し、本方式に変更する理由のまとめ:

| 観点 | ブロック列方式（旧） | 独立列 + cellRenderer 方式（新） |
|------|---------------------|-------------------------------|
| AG Grid の原則 | 1 列 = 2 フィールドで破る | 1 列 = 1 フィールドを維持 |
| cellEditor | カスタム必須（2 入力を自前管理） | AG Grid 標準がそのまま動く |
| Enter ナビゲーション | `useGridEnterNav` をバイパスし独自実装 | `editChainColIds` に追加するだけ |
| `node.setDataValue` | cellEditor 内で副フィールドを直接更新 | 不要 |
| Spec での宣言性 | ブロック内の入力順が手続き的 | `displayRow` と `editChainColIds` で完結 |
| 実装の複雑さ | 高い（専用エディタ + context + suppress） | 低い（cellRenderer 1 つ + CSS） |
