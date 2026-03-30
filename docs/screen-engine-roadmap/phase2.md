# Phase 2: 入力部品（エディタ）と値確定時の副作用を整理する

## このフェーズの目的

**一言で言うと**: セルの入力部品を「型名で呼び出せる仕組み」に変え、値が確定したときの処理（金額計算など）を「宣言的なルール」として書けるようにする。

**背景**: 今の実装では、製品コード用の入力部品（`ProductCodeCellEditor`）が列定義から直接 import されています。また、「製品コードが確定したら品名を埋める」「数量が変わったら金額を再計算する」といった処理も、画面コードの中に直書きされています。

このままだと、新しい画面を追加するたびに似たような入力部品や処理をコピペすることになります。

**Phase 2 で目指すこと**:
- 入力部品は **「`codeAutocomplete` という名前を指定すれば、対応するコンポーネントが自動的に使われる」** 仕組み（レジストリ）にする
- 値確定時の処理は **「このフィールドが変わったら、こうする」というルールの一覧**（commitSpec）として定義し、共通のエンジンが実行する形にする
- 新しい画面を追加するとき、**入力部品のコピペではなく、設定の追加**で済むようにする

---

## 前提

- Phase 1 が完了していること（Enter 移動の列情報が Spec から供給されている）
- **受注デモ画面の見た目・操作感は変えない**（壊したら直す）

---

## 完了条件

1. **エディタのレジストリが存在する**
   - 列定義を作るコードが `ProductCodeCellEditor` を直接 import していない
   - 代わりに `codeAutocomplete` のような文字列（field type）を指定すると、対応するコンポーネントが解決される

2. **`ProductCodeCellEditor` がレジストリの1実装として登録されている**
   - マスタデータ（`PRODUCTS`）は列定義や Spec のパラメータとして外から渡せる

3. **commitSpec が「ルール一覧 + 実行関数」の形になっている**
   - 画面側は `onCellValueChanged` で `applyCommitSpec(rules, event, ctx)` を呼ぶだけ
   - ルールの中身は受注画面用の Spec ファイルにあってよい

4. **少なくとも以下の2つの副作用がルールとして定義されている**
   - 製品コード確定 → 品名を自動入力 + フォーカスを数量に移動
   - 数量 or 単価の確定 → 金額を再計算

---

## 作業手順

### ステップ 2.1: 必要な field type を決める

`screen-spec-plan.md` のセクション 3 を参考に、Phase 2 で使う入力部品の種類を決める。

例:
| field type 名 | 用途 |
|---|---|
| `codeAutocomplete` | コード入力（製品コードなど）。候補リストから選ぶ |
| `numeric` | 数値入力 |
| `readOnlyText` / `readOnlyComputed` | 表示専用（編集不可） |

決めたら `decisions.md` に1行メモしておく。

### ステップ 2.2: レジストリの実装

新しいファイルを作る（例: `src/features/screen-engine/editorRegistry.ts`）。

- `resolveCellEditor(fieldType, params)` のような関数を提供する
- field type の文字列を渡すと、AG Grid の `cellEditor` に設定するコンポーネントと `cellEditorParams` が返る
- `orderNewSpec.ts` の列定義ビルダーを、field type から `ColDef` を生成するように段階的に書き換える

### ステップ 2.3: 製品コードエディタのマスタデータ注入

- マスタ配列（`PRODUCTS`）や大文字変換ルールなどは、列の Spec から `cellEditorParams` として渡す
- コンポーネントを汎用名にリネーム（例: `CodeAutocompleteEditor`）するのは任意。Phase 2 の後半でもよい

### ステップ 2.4: commitSpec の構造化

値確定時の副作用を「ルール」として定義する。

ルールの形（例）:
```typescript
{
  onFields: ['quantity', 'unitPrice'],  // この列の値が変わったとき
  effect: (ctx) => {                     // この処理を実行する
    ctx.setField('amount', ctx.getValue('quantity') * ctx.getValue('unitPrice'))
  }
}
```

- 現在の `orderCommitSpec.ts` のロジックを、上のようなルール配列に移植する（実装では `orderCommitRules.ts` に分離済み）
- 受注用のルールは `orderCommitRules.ts` に置き、汎用実行は `applyCommitSpec`（`screen-engine`）を使う
- 画面側は汎用関数 `applyCommitSpec(rules, event, ctx)` を呼ぶだけにする

**動作確認**: 品名の自動入力、金額の再計算、確定後のフォーカス移動が壊れていないこと。

### ステップ 2.5: ドキュメント更新

`screen-spec-plan.md` の「参考（現状コード）」に書いてあるファイル名が変わった場合、該当箇所だけ修正する（全体の書き換えは不要）。

---

## 手動チェックリスト

**Phase 1 のチェックリストをまず全部やり直す。** 加えて以下を確認する:

- [ ] 列定義のコードを見ると、`ProductCodeCellEditor` が直接並んでいない（レジストリ経由か、ビルダー1か所に集約されている）
- [ ] Spec に「表示専用の計算列」を1つ追加する手順が、ドキュメントとして書ける程度にシンプルになっている

### 読み取り専用の計算列を足す手順（チェックリスト用）

`buildOrderAltColumnDefs` の「商品分類」列と同じパターンでよい。

1. `orderNewSpec.ts` で、列の配列にオブジェクトを1つ追加する。
2. 次を spread する: `resolveGridFieldTypePartial({ fieldType: 'readOnlyComputed', params: { valueGetter: (p) => ... } })`  
   - `valueGetter` は AG Grid の `ValueGetterParams` を受け取り、表示したい文字列（または数値）を返す。
3. 同じオブジェクトに `headerName`・`width` を付ける。`field` がない列は `colId` を付けて列を識別する（例: `category`）。
4. デフォルト列セットだけに足す場合は `buildOrderColumnDefs` 側に書く。横展開サンプル（alt）だけに足す場合は `buildOrderAltColumnDefs` の `...cols` の後に足す。

参照実装: `buildOrderAltColumnDefs` 内の `headerName: '商品分類'` の列。

---

## Phase 3 に渡すもの

field type と commitSpec の仕組みが整ったら、ヘッダの入力部品（`MasterCombobox` など）も同じ仕組みに載せる準備が整います。Phase 3 で `headerSpec` の `editorType` と統合します。
