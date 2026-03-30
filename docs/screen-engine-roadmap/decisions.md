# 設計判断の記録（共通エンジン + Spec）

実装中に設計上の判断が必要になったら、ここに記録します。
`screen-spec-plan.md` セクション 8 の未確定事項を解消したときも、ここに書きます。

長文である必要はありません。**日付・何を決めたか・なぜそうしたか**の3点を1〜3行で書けば十分です。

## 書き方のテンプレート

```
### YYYY-MM-DD — 短いタイトル
- **決めたこと**: …
- **理由**: …
```

---

## 記録

### 2026-03-30 — Phase 3: Enter 順・ハンドラ接続・未割当 F キー
- **決めたこと**: Enter 順は **配列**（`navigationSpec.headerEnterOrder` / `gridEditChainColIds`）。画面固有処理は **マウント時に関数を注入**（`useKeySpec(handlers)`、`handleNew` / `handleSave` など）。`mergeKeySpec` 後も **アクションにハンドラが無い F キーは何もしない**（preventDefault もしない）。
- **理由**: `phase3.md` の事前決定に合わせ、Spec はデータ、挙動は Vue 側でテストしやすくする。

### 2026-03-30 — Phase 2: グリッド field type 一覧
- **決めたこと**: Phase 2 で採用する field type は `codeAutocomplete`（コード＋候補リスト）、`numeric`（数値編集）、`readOnlyText`（表示のみ）、`readOnlyComputed`（valueGetter による表示専用）の4種。解決関数は `resolveGridFieldTypePartial` とし、AG Grid の `ColDef` 断片を返す。
- **理由**: `phase2.md` の方針と `screen-spec-plan.md` セクション3に沿い、列定義は型名＋パラメータの組み合わせで組み立てる。

### 2026-03-30 — Phase 1: Enter ナビ用モジュール配置
- **決めたこと**: Phase 1 当時は `useOrderGridEnterNav.ts` と `useScreenFunctionKeys.ts` を `order-screen` に置いた。**Phase 3 で** グリッド Enter は `src/features/screen-engine/useGridEnterNav.ts` に一般化し、F キーは `useKeySpec` に置き換えた（旧ファイルは削除）。
- **理由**: 複数業務画面で同じコンポーザブルを使うため。
