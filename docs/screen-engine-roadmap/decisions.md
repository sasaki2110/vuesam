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

### 2026-03-30 — Phase 2: グリッド field type 一覧
- **決めたこと**: Phase 2 で採用する field type は `codeAutocomplete`（コード＋候補リスト）、`numeric`（数値編集）、`readOnlyText`（表示のみ）、`readOnlyComputed`（valueGetter による表示専用）の4種。解決関数は `resolveGridFieldTypePartial` とし、AG Grid の `ColDef` 断片を返す。
- **理由**: `phase2.md` の方針と `screen-spec-plan.md` セクション3に沿い、列定義は型名＋パラメータの組み合わせで組み立てる。

### 2026-03-30 — Phase 1: Enter ナビ用モジュール配置
- **決めたこと**: `useOrderGridEnterNav.ts` と `useScreenFunctionKeys.ts` を `src/features/order-screen/` に置き、受注画面専用の切り出しとして扱う。製品コード列のオートコンプリート特例は composable 内に `productCode` 固定で残した（Phase 2 で field type 化するまでの暫定）。
- **理由**: ロードマップの例示パスに合わせつつ、ルート `composables/` を増やさず既存の `order-screen` 機能フォルダにまとめる。
