# 技術課題バックログ

今すぐ着手する必要はないが、将来のトリガー条件を満たしたときに対応する課題の一覧。
各課題の実施判断は「トリガー」欄に記載した条件で行う。

---

## 課題一覧

| # | 課題 | トリガー | 優先度 |
|---|------|----------|--------|
| 1 | [ListScreenView の分割リファクタリング](#課題-1-listscreenview-の分割リファクタリング) | 2 つ目の一覧画面を追加するとき | 中 |
| 2 | [明細部の表現方法・見せ方の最適化](#課題-2-明細部の表現方法見せ方の最適化) | 画面仕様が明確になり、明細の表現方法を検討できるようになったとき | 中 |
| 3 | [受注変更画面の将来拡張](#課題-3-受注変更画面の将来拡張) | 受注変更を運用し、競合防止・監査・ワークフロー等の要件が出たとき | 低〜中 |

---

## 課題 1: ListScreenView の分割リファクタリング

### 現状

`ListScreenView.vue` は 528 行（スクリプト 334 行 + テンプレート 71 行 + CSS 121 行）。一覧画面が受注一覧 1 画面のみのため、現時点では `ListScreenSpec` による宣言的な制御で画面追加時に Vue ファイルの編集は不要。ただし、以下の構造的な問題がある。

| 問題 | 行数 | 備考 |
|------|------|------|
| CSS が `RegistrationScreenShell.vue` と大部分重複 | ~80 行 | `.page`, `.hdr`, `.btn`, `.card`, `.header-grid` 等 |
| フォーマット関数がべた書き | ~30 行 | `formatCalendarDate`, `formatDateTime`, `formatNumber`, `formatCellValue` |
| ヘッダ ref 管理のボイラープレート | ~27 行 | `bindHeaderRef` / `headerFieldRef` / `headerFieldRefCallbacks` |
| 検索・削除ロジックが composable に切り出されていない | ~80 行 | `runSearch`, `buildSearchQueryParams`, `handleDelete` |

### トリガー

**2 つ目の一覧画面（例: 発注一覧、製品一覧）を追加するとき。** 現時点では Spec による宣言的制御で十分だが、CSS 重複やフォーマット関数の散在が顕在化したタイミングで実施する。

### 対応方針

C（ScreenWorkspaceView の分割）と同じアプローチ。

| 切り出し対象 | 切り出し先 | 削減見込み |
|---|---|---|
| CSS の共通部分 | 共通 CSS ファイル or CSS 変数化 | ~80 行 |
| フォーマット関数 | `src/utils/formatters.ts` | ~30 行 |
| ヘッダ ref 管理 | composable `useHeaderFieldRefs.ts` | ~27 行 |
| 検索/削除ロジック | composable `useListScreenActions.ts` | ~80 行 |

### 関連ドキュメント

- [archive/next-roadmap/B-list-screen.md](./archive/next-roadmap/B-list-screen.md) — 一覧画面の設計
- [archive/next-roadmap/C-view-refactor.md](./archive/next-roadmap/C-view-refactor.md) — 登録画面で同種の分割を実施済み（参考パターン）

---

## 課題 2: 明細部の表現方法・見せ方の最適化

### 現状

[archive/next-roadmap/A-grid-two-row-display.md](./archive/next-roadmap/A-grid-two-row-display.md) で明細の疑似 2 段化を検討したが、以下の理由で **先送り** としている。

- AG Grid の設計思想に逆らう力技が必要で、実装が複雑
- 具体的な画面要件（何列の画面で横幅がどれだけ不足するか）が確定していない
- オフコンの 2 段レイアウトはターミナル画面の制約であり、ブラウザでは他の手段がある

A-grid-two-row-display.md には 5 つの代替案が整理されている。

| 案 | 概要 | 適するケース |
|----|------|------------|
| 案 1 | 横一列のまま列をコンパクトに | 補助項目が少ない |
| 案 2 | 横一列 + 重要度で列を分類 | よく見る列とたまに見る列が分けられる |
| 案 3 | 行クリックで詳細パネルを開く | 補助項目が多いが一覧性は主要列だけで十分 |
| 案 4 | AG Grid の Master/Detail（Enterprise） | Enterprise ライセンスがある場合 |
| 案 5 | 疑似 2 段（方式 C） | オフコン画面の忠実な再現が必要 |

### トリガー

**画面仕様が明確になり、明細の表現方法を検討できるようになったとき。** 具体的には以下のいずれかが満たされた場合。

- 実業務の画面仕様書で明細の項目数・列幅が確定した
- 現在の横一列レイアウトで「横幅が足りない」という具体的な課題が発生した
- 画面のモック・プロトタイプレビューで表現方法の判断が可能になった

### 対応方針

1. A-grid-two-row-display.md の「選定の判断基準」に従い、具体的な画面要件に最適な案を選定する
2. 案 1・2 であれば追加実装ゼロ。案 3 であれば詳細パネルを新規実装。案 5 であれば A の方式 C を実装
3. 選定結果を A-grid-two-row-display.md の冒頭ステータスに記録する

### 関連ドキュメント

- [archive/next-roadmap/A-grid-two-row-display.md](./archive/next-roadmap/A-grid-two-row-display.md) — 技術設計・代替案・方式 C の詳細設計

---

## 課題 3: 受注変更画面の将来拡張

### 由来

受注変更画面（`OrderEditPage` / `PUT /api/orders/{id}`）の初版実装にあたり、[archive/update-roadmap/order-edit.md](./archive/update-roadmap/order-edit.md) の「将来の拡張ポイント」に列挙されていた項目。ロードマップをアーカイブした後も見失わないよう、ここに転記する。

### 検討項目（当時ロードマップより）

1. **楽観的排他制御**（`version` / `updatedAt` を使った競合検知）
2. **明細行の個別削除**（行選択 → 削除キー or コンテキストメニュー）
3. **変更履歴の表示**（受注の変更ログ）
4. **ステータス管理**（確定済み受注は変更不可など）
5. **変更画面から新規登録への切替**（F1 で新規モードに切り替え）

### トリガー

上記のいずれかが業務・非機能要件として具体化したとき（例: 同時編集のインシデント、監査対応、伝票ステータス導入）。

### 関連ドキュメント

- [archive/update-roadmap/order-edit.md](./archive/update-roadmap/order-edit.md) — 当初の実装ロードマップ全文（設計メモ・API 例を含む）
