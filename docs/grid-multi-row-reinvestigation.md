# 明細グリッドの複数行構成 — 再調査レポート

> **ステータス: 検討用たたき台**
>
> 前回（`docs/archive/next-roadmap/A-grid-two-row-display.md`）で「方式 C を採用するも先送り」となった経緯を踏まえ、別ルートを再評価したもの。実装着手前の検討材料として作成。

---

## 1. 背景

- 本リポジトリは Vue 3 + ag-grid-community v35.2 で、PF キー＋Enter で操作するオフコン風画面のデモ。
- 1 明細に 10〜15 項目ある業務画面では、横並びだけでは収まらない。
- 前回検討時は **「明細を複数行構成（疑似 2 段）にできないか」** を調査したが、以下の理由で先送り：
  - 採用した方式 C が「AG Grid の設計に逆らう力技」（CSS オーバーライド・cellRenderer での上下半分描画）になり、保守コストが高い。
  - 具体的な画面要件（何列／どの項目を 2 段目に置くか）が未確定だった。
- 今回、改めて AG Grid v35 の機能と本リポジトリの既存資産を見直したところ、**前回検討に含まれていなかったルート（方式 D）** が有力と判明。

---

## 2. 前回の方式まとめ（再掲）

| 方式 | 概要 | 致命的な問題 |
|---|---|---|
| **A: 独立列 + 段ずらし** | 数量と個別納期を別列に並べ、cellRenderer で上下に振り分け | 半分が空白で見た目がぎこちない |
| **B: ブロック列（1 列に 2 フィールド）** | 数量＋個別納期を 1 列に押し込む | AG Grid の「1 列＝1 field」を破る → cellEditor 自作・Enter 自前再実装が必要 |
| **C: 独立列 + Column Group + cellRenderer 上下半分描画**（前回採用） | 行高 72px、CSS で上半分／下半分に描画 | `.ag-cell-wrapper` への CSS オーバーライドが必要、編集中は cellRenderer が消えて全高に変化 |

**前回の共通前提**: 「rowData は増やさない（＝物理 1 行のまま、見た目だけ 2 段化する）」

---

## 3. 新提案：方式 D — **「1 論理明細 = 2 物理行 + cellSpan」**

### 3.1 発想の転換

前回の前提「rowData は増やさない」を **外す**。AG Grid v33.1 で community 版に追加された **`enableCellSpan` + `spanRows`** を素直に使う方針。

この機能は本リポジトリの **一覧画面で既に稼働中**：
- `src/features/order-screen/orderListSpec.ts:31-50`（受注ヘッダ列に `spanRows: true`）
- `src/views/ListScreenView.vue:187-213`（同一 `id` の隣接行だけ結合する `spanRowsByGroupField`）
- `docs/screen-specs/order-list.md`（仕様書側にも明記）

つまり **新機能の導入ではなく、既存機能を編集画面側にも展開する** 案。

### 3.2 データ構造

1 論理明細を `main` 行と `sub` 行のペアで表現する。

```ts
type OrderLineRow =
  | {
      itemId: number       // 明細を一意に識別（main/sub 共通）
      rowType: 'main'
      lineNo: number
      productCode: string
      productName: string
      quantity: number
      unitPrice: number
      amount: number
      // sub 専用フィールドは undefined
      individualDueDate?: undefined
      lotNumber?: undefined
      lineNote?: undefined
    }
  | {
      itemId: number
      rowType: 'sub'
      lineNo: number
      individualDueDate: string
      lotNumber: string
      lineNote: string
      // main 専用フィールドは undefined
      productCode?: undefined
      productName?: undefined
      quantity?: undefined
      unitPrice?: undefined
      amount?: undefined
    }
```

`rowData` は `[main(item1), sub(item1), main(item2), sub(item2), ...]` の順で並べる。

### 3.3 見た目イメージ

```
┌──┬──────────┬──────────┬─────┬───────┬───────┐
│行│ 製品コード│  製品名  │数量 │ 単価  │ 金額  │
├──┼──────────┼──────────┼─────┼───────┼───────┤
│  │  B001    │ ﾘﾁｳﾑｾﾙL  │ 100 │ 1,500 │150,000│  ← rowType:'main'
│ 1│          │          │     │       │       │
│  ├──────────┴──────────┴─────┴───────┴───────┤
│  │ 納期 2026-04-10  ﾛｯﾄ L0042  備考 急ぎ     │  ← rowType:'sub'
├──┼──────────┬──────────┬─────┬───────┬───────┤
│  │  B004    │ AGMﾊﾞｯﾃﾘｰ│  50 │ 3,200 │160,000│
│ 2│          │          │     │       │       │
│  ├──────────┴──────────┴─────┴───────┴───────┤
│  │ 納期 2026-05-01  ﾛｯﾄ L0050               │
└──┴───────────────────────────────────────────┘
```

- `行` 列は `spanRows` で main+sub のペアを縦結合 → 1 セルに見える
- main 行は通常列レイアウト
- sub 行は「複数列を横方向に結合した 1 セル」or「sub 行用の別列定義」のどちらでもよい

### 3.4 主要 ColDef 設定

| 列 | `editable` | 値の表示 |
|---|---|---|
| `lineNo` | `false` | `spanRows: ({nodeA, nodeB}) => nodeA?.data?.itemId === nodeB?.data?.itemId` でペア結合 |
| `productCode` / `productName` / `quantity` / `unitPrice` / `amount` | `(p) => p.data?.rowType === 'main'` | sub 行では空表示（`valueFormatter` で `''` を返す） |
| `individualDueDate` / `lotNumber` / `lineNote` | `(p) => p.data?.rowType === 'sub'` | main 行では空表示 |

```ts
{
  headerName: '数量',
  field: 'quantity',
  editable: (p) => p.data?.rowType === 'main',
  ...resolveGridFieldTypePartial<OrderLineRow>({ fieldType: 'numeric' }),
  valueFormatter: (p) => p.data?.rowType === 'main'
    ? (p.value == null ? '' : Number(p.value).toLocaleString('ja-JP'))
    : '',
}
```

### 3.5 Enter ナビゲーション

`useGridEnterNav` を rowType 対応に拡張：

```ts
// 例: 編集チェーンを rowType ごとに 2 配列で持つ
const GRID_EDIT_CHAIN_MAIN = ['productCode', 'quantity', 'unitPrice'] as const
const GRID_EDIT_CHAIN_SUB  = ['individualDueDate', 'lotNumber', 'lineNote'] as const
```

ナビゲーション規則：

1. main 行の最終編集列で Enter → **同一 itemId の sub 行**の最初の編集列にフォーカス
2. sub 行の最終編集列で Enter → **次の itemId の main 行**の最初の編集列にフォーカス
3. 最終 itemId の sub 行の最終列で Enter → 新しい itemId のペア（main + sub）を追加して main の `productCode` にフォーカス

これは現在の「行末 → 次行」ロジックの軽い拡張で済む。

### 3.6 バリデーションと API 変換

- **バリデーション**: `validateGridRows` に rowType を意識する分岐を追加（main は `productCode` 必須、sub は任意項目のみ、など）
- **保存時の API 変換**: 送信前に main+sub のペアを 1 つの `OrderLine` に畳む変換関数を 1 つ用意
  ```ts
  function flattenRowsToLines(rows: OrderLineRow[]): OrderLine[] {
    const byItemId = new Map<number, Partial<OrderLine>>()
    for (const r of rows) {
      const acc = byItemId.get(r.itemId) ?? {}
      Object.assign(acc, r) // rowType フィールドは送信前に削除
      byItemId.set(r.itemId, acc)
    }
    return [...byItemId.values()] as OrderLine[]
  }
  ```
- **読み込み（変更画面）**: 逆変換 `expandLinesToRows(lines)` で 1 OrderLine を main+sub の 2 行に展開

---

## 4. 方式 D vs 方式 C 比較

| 観点 | 方式 C（前回採用） | **方式 D（今回提案）** |
|---|---|---|
| AG Grid の 1 列 = 1 field 原則 | 維持 | **維持** |
| cellEditor | 標準で OK | **標準で OK** |
| cellRenderer | 上下半分描画の自作必須 | **不要**（`valueFormatter` で空文字を返す程度） |
| `.ag-cell-wrapper` への CSS オーバーライド | 必須 | **不要** |
| 編集中の上下位置の喪失 | あり（許容） | **無し**（セルが分かれているので編集時も自然） |
| Column Group ヘッダ調整 | 必要 | **不要**（通常列のまま） |
| Enter ナビ | `editChainColIds` に追加 | `editChainColIds` を rowType ごとに 2 配列 ＋ `useGridEnterNav` を拡張 |
| AG Grid のバージョンアップ耐性 | CSS セレクタ依存で壊れやすい | **公式 API のみで構築** |
| 既存資産の活用度 | ゼロ（新規実装） | **list 画面で稼働中の cellSpan を流用** |
| バリデーション/API 変換 | rowData そのまま | **保存前に main/sub を畳む軽い変換層が必要** |

### 方式 D の追加コスト

- `useGridEnterNav.ts` に rowType を見て次セルを決めるロジック追加（推定 30〜50 行）
- `screenSpecTypes.ts` に rowType サポート（型追加）
- 画面 Spec に `editable` を関数化（`(p) => p.data?.rowType === 'main'` 等）
- API 変換関数 1 ペア（`flatten` / `expand`）

---

## 5. 残る検討材料

具体着手前に決めたいこと：

1. **1 明細あたりの項目数** — 10？ 15？ それ以上？
2. **どの項目を上段（main）／下段（sub）に置くか** — 業務的な視認頻度で分類
3. **Enter でスキップしたい列があるか** — 例：金額（自動計算）は main 編集列に含まない
4. **sub 行の列構成** — main 行と同じ列定義に乗せるか、sub 行は「横長 1 セル」にまとめるか
5. **新規追加のキー操作** — F キーで「sub 行だけ追加」「ペアごと削除」など必要か
6. **既存画面（受注登録／変更）との互換性** — 既存の `OrderLine` 型・API を変えずに、フロント内部だけで row pair を扱うか

---

## 6. 推奨スコープ（着手するなら）

**最小 PoC（リスク確認）**:
- 受注登録画面 1 画面のみ
- sub 行は **1 列だけ**（`individualDueDate` のみ）
- 既存の `OrderLine` 型は変えず、フロント内部の `OrderLineRow` だけで pair を扱う
- `useGridEnterNav` の拡張は最小限（main → sub → 次 main の固定ルール）

これで、**「cellSpan + rowType による複数行構成が業務画面として違和感なく動くか」** を確認できる。動けば、列を増やし・編集チェーンを充実させて本実装へ。

---

## 7. 結論

- 技術的には **十分可能**。前回の方式 C より明らかに筋が良い。
- **既に list 画面で稼働している `cellSpan`** を edit 画面側にも展開する形なので、AG Grid の設計思想に沿う。
- 追加コストは **engine の Enter ナビ拡張** と **API 変換層** に限定される。
- 着手するかは「画面要件（何項目／どの分類）」次第。これが決まれば PoC は 1〜2 日規模で組める見込み。

---

## 参考

- 前回検討資料: `docs/archive/next-roadmap/A-grid-two-row-display.md`
- 既存の cellSpan 実装:
  - `src/features/order-screen/orderListSpec.ts:31-50`
  - `src/views/ListScreenView.vue:187-213`
- AG Grid 公式:
  - Row Spanning: https://www.ag-grid.com/vue-data-grid/row-spanning/
  - Cell Components (cellRenderer): https://www.ag-grid.com/vue-data-grid/component-cell-renderer/
  - Row Height: https://www.ag-grid.com/vue-data-grid/row-height/

---

## 追記 1: 実画面要件のヒアリング（受注計上入力 / kinou02_01.jpg）

> 上記の本文は「2 段化」を前提とした検討。実ユーザーへヒアリングしたところ、**「30 項目を 4 段くらいで表示し、横スクロールしない」** という要望と判明。さらにモダナイ元画面のスクショ（`docs/kinou02_01.jpg`「受注計上入力」）を入手し、以下の追加分析を行った。

### A. スクショから読み取れた構造

**画面**: 受注計上入力（オフコン）

**PF キー**: F1=登録, F2=ブランク, F3=削除, F4=キャンセル, F5=検索, F6=前頁, F7=次頁, F8=参照, F9=行追加, F10=行削除, F11=行修復, F12=終了, Ctrl+0/1/3/4/E

**ヘッダ**: 受注NO / 受注日 / 指定納期 / 出荷予定日 / 見積NO / 得意先 / 特殊（？）/ 担当者 / 納品先 / エンドユーザ / 登録 / 受注区分（0:通常, 1:預出荷, 2:預売上）

**明細グリッド**: 明細 1 件 = **3〜4 物理行**

| 明細 | 段数 | 段ごとの内容例 |
|---|---|---|
| 1 トイレットペーパー | 3 段 | 段1=`売上 / 商品コード001011 / 通常 50.00 / 220.00 / …`<br>段2=`しない / ない / ケース / 0 / 200.00 / …`<br>段3=`しない / ない / 箱 / 50.00 / 150.00 / 7,500 / 2021-11-04 / 未完` |
| 2 ボディーソープ | 3 段 | 同様 |
| 3 洗顔スクラブ | 4 段 | 段1〜3 は同様、**段4** = `12 手配 未完 0000200001 (株)マツナガ東京` |

### B. 決定的に重要な観察

1. **列ヘッダは 1 段のみ**（区分／商品／ロットNO／商品名／状態／入数／単位／上代単価／率／受注金額／受注消費税額／指定納期／出荷予定日／付箋／出荷状況）
2. **列幅は全行で揃っている**（縦のラインがきれいに揃う）
3. **同じ列スロットに「行種別ごとに違う項目」** が入る
   - 「入数」列: 段1=`50.00（通常）`, 段2=`0（ケース）`, 段3=`50.00（箱）`
   - 「上代単価」列: 段1=`220.00`, 段2=`200.00`, 段3=`150.00`
4. **段数は明細ごとに可変**（3 段の明細もあれば 4 段の明細もある）
5. **各段の左端に「行種別ラベル」が入る**（`通常 / ケース / 箱 / 手配` など）→ 段の意味が見て分かる
6. F9=行追加 / F10=行削除 / F11=行修復 は **明細単位** の操作（推測）

### C. 本文「30項目×4段で横スクロール禁止」を聞いた直後の方式 H/I の扱い

ヒアリング直後、列ヘッダが段ごとに違う場合を懸念して以下の追加方式を検討した：

| 方式 | 概要 | 30×4 への適性 |
|---|---|---|
| **H: カード式リピータ**（ag-grid を捨て、Vue で「1 明細 = 4 行のミニフォーム」を縦に並べる） | ◎ | 自由度は高いが ag-grid 機能を全捨て |
| **I: ag-grid + 編集パネル**（主要列のみ ag-grid、選択明細は別パネルで 30 項目編集） | ◎ | 「30項目を一覧で同時に見たい」を満たせない |

**しかしスクショを見て、これらは不要と判明**：
- 列ヘッダが共通 1 段で意味が成立している → セル内ラベル描画が不要
- 列幅が揃う設計 → ag-grid の列モデルがそのまま乗る
- 行種別ラベル（左端）で段の意味が分かる → 段ごとの sticky header も不要

→ **方式 D（rowType + cellSpan）の枠組みが、画面要件側ですでに「ag-grid に乗るように」設計されている**。H/I は破棄でよい。

### D. 方式 D を「段数可変・itemGroup 単位」に拡張する

本文の方式 D は「main + sub の 2 行ペア」だったが、実画面は **2〜4 段（将来的にもっと？）の可変段数**。これを扱うため `itemGroup` 概念を導入する。

#### D.1 データ構造（拡張版）

```ts
type OrderLineRow = {
  itemId: number          // 明細を一意に識別（同一 itemId 内の行は同じ明細に属する）
  rowKind: string         // 行種別（'sales-normal' | 'sales-case' | 'sales-box' | 'tehai' など）
  rowOrder: number        // 同一 itemId 内での段の並び順（0,1,2,3）
  // 以下は rowKind に応じて使うフィールドを切り替える（共通スキーマでも個別でもよい）
  productCode?: string
  productName?: string
  unit?: string           // '通常' | 'ケース' | '箱' | '個' …
  quantity?: number       // 入数
  unitPrice?: number      // 上代単価
  rate?: number           // 率
  amount?: number         // 受注金額
  tax?: number            // 受注消費税額
  dueDate?: string        // 指定納期
  shipDate?: string       // 出荷予定日
  // 段4（手配先情報）専用
  tehaiPartyCode?: string
  tehaiPartyName?: string
  // … 30 項目分
}
```

`rowData` は `[item1.row0, item1.row1, item1.row2, item2.row0, item2.row1, item2.row2, item2.row3, …]` の順で並ぶ。

#### D.2 列定義のパターン

「同じ列スロットに rowKind ごとに違うフィールドを入れる」を実現するには 2 流派がある：

**流派 α: 1 列 = 1 物理 field（複数 rowKind が同じ field を使う）**
- `quantity` 列は段1〜段3 で共通の `quantity` field を使う
- 段4（手配）では editable=false で空表示
- メリット: ag-grid の 1 列 = 1 field 原則を完全維持
- デメリット: スキーマが 30 項目より少なくなる（fields を共有する分）

**流派 β: 1 列 = 複数 field（rowKind で valueGetter/valueSetter を切替）**
- `quantity` 列は valueGetter で `data.rowKind === 'sales-normal' ? data.quantity : data.caseQuantity` のように切替
- メリット: rowKind ごとに独立した 30 項目スキーマを持てる
- デメリット: cellEditor の getValue → setDataValue マッピングを valueSetter で吸収する必要

スクショを見る限り、段1〜段3 の「入数」「上代単価」は本質的に **同じ意味（単位だけ違う）** に見えるので、**流派 α が自然**。手配段（段4）だけ独立 field 群を持つハイブリッド構成も可能。

#### D.3 cellSpan の使いどころ

- `行番号 / 区分（売上/発注）` 列など、明細単位で 1 セルにしたい列：`spanRows: ({nodeA, nodeB}) => nodeA.data.itemId === nodeB.data.itemId`
- 段の左端ラベル列（`通常 / ケース / 箱`）は spanRows しない（段ごとに値が違う）
- 「商品コード」「商品名」は段1 のみ表示で、段2 以降は空表示（spanRows でもよいが、編集制御の観点からは段1 だけ editable のほうが安全）

#### D.4 Enter ナビゲーション仕様

```
itemGroup 内：段0 → 段1 → 段2 → … → 段(n-1)
itemGroup 末尾の編集列で Enter → 次 itemGroup の 段0 の最初の編集列
最終 itemGroup の末尾で Enter → 新しい itemGroup を追加（規定段数で）
```

`useGridEnterNav` の拡張ポイント：

1. 「次のセル」を決めるとき、現在の `data.rowKind` と `data.itemId` を見て次の段／次の itemGroup を解決
2. 編集チェーンは `rowKind` ごとに別配列で持つ：
   ```ts
   const EDIT_CHAIN_BY_ROWKIND = {
     'sales-normal': ['productCode', 'quantity', 'unitPrice', 'dueDate', …],
     'sales-case':   ['quantity', 'unitPrice', …],
     'sales-box':    ['quantity', 'unitPrice', 'shipDate', …],
     'tehai':        ['tehaiPartyCode', …],
   }
   ```
3. 段スキップ判定：rowKind の編集チェーンが空なら段ごとスキップ

#### D.5 F キー（行操作）の再定義

| PF キー | 旧来の動き | 新方式での意味 |
|---|---|---|
| F9 行追加 | 行追加 | **itemGroup 追加**（規定段数で 3〜4 行を一括 push） |
| F10 行削除 | 行削除 | **itemGroup 削除**（選択行の itemId に属する全行を一括 pop） |
| F11 行修復 | 削除 undo？ | 削除した itemGroup の復元 |
| F2 ブランク | クリア | itemGroup の値クリア（行は残す） |
| - | - | **段の追加削除**（明細内で 3 段 ↔ 4 段切替）が必要なら別キーを割当 |

### E. 列幅の実現性（30 項目 / 段あたり 7〜8 項目）

スクショの列ヘッダは「区分／商品／ロットNO／商品名／状態／入数／単位／上代単価／率／受注金額／受注消費税額／指定納期／出荷予定日／付箋／出荷状況」で、**約 15 列**。1 明細 = 3〜4 段を使うことで **15 × 4 = 60 セル**まで使えるが、実際は段ごとに使うセル数は 7〜10 程度。

横スクロール禁止の前提なら、画面幅 1280〜1440px に対し列幅 70〜120px をギリギリまで詰める運用。スクショもまさにそうなっている（`状態`列は約 50px、`単位`列は約 50px、`受注金額`は約 80px）。

→ **30 項目を全部独立列にせず、複数 rowKind で同じ列スロットを共有することで、物理列数を 15 程度に抑える** のが本方式の本質。

### F. 改めての結論

- **方式 D + itemGroup（段数可変）拡張で実装可能**。ag-grid を捨てる必要はない。
- スクショの画面構造は、まさに「rowType + cellSpan モデル」が想定する形。
- エンジン側に追加が必要なのは：
  1. `itemId` / `rowKind` / `rowOrder` を扱う型と Spec 拡張
  2. `useGridEnterNav` の段間／itemGroup 間ナビゲーション
  3. `KeyActionId` に `addItemGroup` / `deleteItemGroup` / `restoreItemGroup` を追加
  4. cellSpan 用の `spanRowsByItemId` ヘルパー（list 画面の `spanRowsByGroupField` と同型）
  5. 行追加時に「規定段数の itemGroup」を生成する factory
- 画面側（`<screen>NewSpec.ts` / `<screen>Grid.ts`）の追加は：
  - rowKind ごとの編集チェーン定義
  - 列定義の `editable` / `valueGetter` を rowKind 関数化
  - 段の左端ラベル列（`通常 / ケース / 箱` など）の renderer

### G. 推奨スコープ（更新版）

**PoC（リスク確認）**:
- 受注計上入力 1 画面、明細 5 件規模
- 段数固定 3 段（売上通常 / 売上ケース / 売上箱）でまず動かす
- 列は 8 列程度に絞る（区分／商品コード／商品名／単位／入数／上代単価／受注金額／指定納期）
- F9 行追加 = itemGroup 追加（3 段固定）、F10 = itemGroup 削除のみ実装

**本実装（PoC で握ったあと）**:
- 段数可変対応（手配段の動的追加）
- 残り 22 項目の充填
- F11 行修復、付箋、出荷状況などの周辺機能
- バリデーション（段ごとのルール）、API 変換（itemGroup → ドメインモデル）

---

## 追記 2: 解像度が上がった検討材料（本文 5 章の更新）

本文 5 章「残る検討材料」のうち、スクショで判明した内容で更新できる項目：

| 項目 | 当初 | スクショ後 |
|---|---|---|
| 1 明細あたりの項目数 | 不明 | **約 30 項目** |
| どの項目を上段／下段に置くか | 不明 | **段ごとに「単位ごとの計上行（通常／ケース／箱）」+ 必要なら手配段** |
| Enter でスキップしたい列 | 不明 | **rowKind の編集チェーンに含まれない列はスキップ**（金額は自動計算で除外など） |
| sub 行の列構成 | 不明 | **同一列スロットを段で使い回す**（流派 α） |
| 新規追加のキー操作 | 不明 | **F9/F10/F11 を itemGroup 単位の操作として再定義** |
| 既存画面との互換性 | 不明 | **新規画面（受注計上入力）として作る前提**。既存の `OrderLine` 型は触らない |

未確定：
- 4 段目（手配段）の発生条件（自動 or 手動）
- F11 行修復の正確なセマンティクス
- 段内で項目を「サブグループ化」する必要があるか（例：「率」と「金額」をペアで扱う等）

---

## 参考画像

- `docs/kinou02_01.jpg` — モダナイ元の「受注計上入力」画面スクショ
