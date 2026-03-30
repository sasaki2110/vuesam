# Phase 4: Markdown による画面定義と AI コーディングへの橋渡し

## このフェーズの目的

**一言で言うと**: 新しい業務画面の要件を **Markdown で記述** し、AI コーディング支援がそれを読んで TypeScript の Spec ファイルを生成する運用を確立する。

**背景**: Phase 3 までで「新画面 = 新 Spec ファイル」の構造が整った。当初の Phase 4 は Spec を JSON/YAML に外部化する計画だったが、以下の理由で方針を変更した。

- このプロジェクトの Spec 編集者は主に AI コーディング支援である
- TypeScript のまま保持するほうが、型安全性・インライン関数・IDE 補完の恩恵を受けられる
- AI にとって JSON/YAML と TypeScript の読みやすさに差はなく、むしろ型情報があるほうが正確に生成できる

そこで Phase 4 では、**人間が自然に書ける Markdown の画面定義** → **AI が TypeScript Spec に変換**、という流れを整備する。

---

## 画面定義 Markdown の書き方

### 基本構造

1つの画面定義は、以下のセクションで構成する。

```markdown
## 画面: ＜画面名＞

### ヘッダ
| 項目 | 入力方式 | 備考 |
|------|---------|------|
| ...  | ...     | ...  |

### 明細グリッド
| 列名 | 型 | 編集 | 備考 |
|------|-----|------|------|
| ...  | ... | ...  | ...  |

### 値確定ルール（副作用）
- ＜トリガー＞ → ＜処理内容＞

### Fキー
- F8: ＜機能名＞

### マスタ・データソース
| 用途 | API | レスポンス形式 | 備考 |
|------|-----|--------------|------|
| ...  | ... | ...          | ...  |

### 画面アクション → API
| アクション | API | ボディ概要 | レスポンス概要 |
|-----------|-----|-----------|--------------|
| ...       | ... | ...       | ...          |

### 特記事項
- ＜例外的なルール・補足＞
```

---

### 各セクションの書き方

#### ヘッダ

| 列 | 説明 |
|----|------|
| **項目** | ラベルとして画面に表示する名前 |
| **入力方式** | 下の「入力方式の語彙」を参照。揺れは AI が吸収する |
| **備考** | Enter 順の例外、初期値、表示幅（span 2）など |

表の **行の順番がそのまま Enter の移動順** になる。Enter 順から外す項目は備考に「Enter 順から除外」と書く。

#### 明細グリッド

| 列 | 説明 |
|----|------|
| **列名** | グリッドのヘッダに表示する名前 |
| **型** | 下の「入力方式の語彙」を参照 |
| **編集** | ○ = 編集可 / × = 表示のみ |
| **備考** | 確定時の副作用、自動入力のヒントなど |

表の **編集 ○ の列を上から順に** Enter で巡回する。

#### 値確定ルール（副作用）

`onCellValueChanged` で実行するルールを箇条書きで書く。

```markdown
- 製品コード確定 → 製品名を自動入力し、数量にフォーカス移動
- 数量 or 単価の確定 → 金額 = 数量 × 単価 を再計算
```

単純な項目（副作用なし）は省略してよい。

#### F キー

共通のデフォルト（F1 = 新規、F12 = 保存）は省略可。画面固有のキーだけ書く。

```markdown
- F8: ロット引当ダイアログ（モック）
```

未割り当ての F キーは何もしない（共通ルール）。

#### マスタ・データソース

プルダウンや候補リストの取得先 API を表で書く。

| 列 | 説明 |
|----|------|
| **用途** | 「取引先一覧」「製品一覧」のように、何のための取得か |
| **API** | `GET /api/masters/parties` のようにメソッド + パス |
| **レスポンス形式** | `[{ code, name }]` のように概要。完全な JSON は不要 |
| **備考** | 複数項目で共用する場合など（例: 契約先・納入先で同じ API） |

ヘッダの「マスタ選択」やグリッドの「コード選択」の候補がどの API から来るかを、このセクションで明示する。AI はここを見て `src/api/client.ts` に取得関数を追加し、画面の `onMounted` で呼び出すコードを生成する。

API が未定の段階では `（未定・モック）` と書いてよい。その場合 AI はモックデータで仮実装する。

```markdown
| 取引先一覧 | GET /api/masters/parties | `[{ code, name }]` | 契約先・納入先で共用 |
| 製品一覧   | GET /api/masters/products | `[{ code, name }]` |  |
```

#### 画面アクション → API

F キーやボタン押下時に呼び出す API を表で書く。

| 列 | 説明 |
|----|------|
| **アクション** | 「保存（F12）」「読込（F02）」のように操作名 |
| **API** | `POST /api/orders` のようにメソッド + パス |
| **ボディ概要** | リクエスト JSON の主要フィールド。全フィールドを網羅しなくてよい |
| **レスポンス概要** | レスポンス JSON の主要フィールド |

AI はここを見て `src/api/client.ts` にリクエスト型・レスポンス型・呼び出し関数を追加し、画面の `handleSave` 等を POST 呼び出しに置き換える。

リクエスト/レスポンスの JSON サンプルを1件分書いておくと、AI の型生成精度が上がる。ただしサンプルは任意であり、ボディ概要だけでも十分機能する。

```markdown
| 保存（F12） | POST /api/orders | `{ contractPartyCode, ..., lines: [...] }` | `{ orderId, orderNumber, message }` |
```

#### 特記事項

上のセクションに収まらない例外ルールを箇条書きで書く。

---

### 入力方式の語彙（揺れ許容）

人間が書くときの自然な表現と、AI が変換先とする field type の対応表。完全一致でなくてよい。

| 人間が書く表現 | AI が解釈する field type |
|---|---|
| マスタ選択、コンボ、プルダウン、取引先選択 | `masterCombobox` or `codeAutocomplete` |
| テキスト、文字入力 | `text` |
| 数値、数量、金額 | `numeric` |
| 日付 | `date` |
| コード選択（候補リスト付き） | `codeAutocomplete` |
| 表示のみ、自動計算、読み取り専用 | `readOnlyText` or `readOnlyComputed` |

ヘッダのマスタ選択は `masterCombobox`、グリッドのコード入力は `codeAutocomplete` になる傾向がある。AI は文脈（ヘッダかグリッドか）から判断する。

---

## AI への指示の流れ

1. 人間が `docs/screen-specs/<screen-id>.md` を作成する
2. AI に「`docs/screen-specs/<screen-id>.md` を読んで、画面を追加して」と伝える
3. AI は以下を生成する:

**画面エンジン側（Spec）**:
- `src/features/<screen>-screen/<screen>NewSpec.ts` — Spec 定義
- `src/features/<screen>-screen/<screen>Grid.ts` — 列定義ビルダー
- `src/features/<screen>-screen/<screen>CommitRules.ts` — 副作用ルール
- `src/features/<screen>-screen/<screen>Types.ts` — 行の型
- `src/router/index.ts` へのルート追加
- `src/features/screen-engine/screenSpecRegistry.ts` への登録
- `src/views/ScreenWorkspaceView.vue` への接続（必要に応じて）

**API 接続側**（マスタ・データソース / 画面アクション → API が記載されている場合）:
- `src/api/client.ts` にマスタ取得関数を追加（例: `fetchParties`、`fetchProducts`）
- `src/api/client.ts` にアクション用のリクエスト型・レスポンス型・呼び出し関数を追加（例: `createOrder`）
- `ScreenWorkspaceView.vue` の `onMounted` でマスタ API を呼び出し、`ref` に格納
- `handleSave` 等のハンドラをモックから API 呼び出しに差し替え

**API が未定の場合**: 「マスタ・データソース」や「画面アクション → API」が `（未定・モック）` と書かれている場合、AI はモックデータ（`src/constants/mockData.ts` 相当）で仮実装する。API が確定した後に差し替える。

既存の受注画面（`order-new`）と発注画面（`purchase-new`）が **サンプル Spec** として機能する。AI はこれらのパターンを参照して新しい Spec を生成する。

---

## 定義例

実際に運用する画面定義のサンプルを `docs/screen-specs/` に置く。

| ファイル | 内容 |
|---|---|
| [order-new.md](../screen-specs/order-new.md) | 受注登録画面（現行実装に対応） |
| [purchase-new.md](../screen-specs/purchase-new.md) | 発注登録画面（現行実装に対応） |

新しい画面を追加するときは、これらをコピーして項目を書き換えるのが最も手軽。

---

## 完了条件

1. **このドキュメント（phase4.md）に書き方ガイドとテンプレートがある**
2. **`docs/screen-specs/order-new.md` が現行の受注画面 Spec と一致する定義例になっている**
3. **`docs/screen-specs/purchase-new.md` が現行の発注画面 Spec と一致する定義例になっている**
4. **`decisions.md` に Phase 4 の方針変更が記録されている**
