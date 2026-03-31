# D: バリデーション

## 目的

ヘッダ・明細の入力値チェックと、API エラー（400）のフィールドごとの表示を**共通基盤**として整備する。現在はバリデーションなしで、契約先が空でも保存でき、API が 400 を返してもフィールドにエラー表示されない。

---

## 現状の問題

| 問題 | 具体例 |
|------|--------|
| フロント側の入力チェックがない | 契約先コードが未選択でも F12 で保存処理に進む |
| 唯一のチェックが手続き的 | `handleSave` の `if (lines.length === 0) { alert(...) }` だけ |
| API 400 エラーがフィールドに紐づかない | `catch` で `alert('登録に失敗しました')` と表示するのみ |
| エラー表示の UI がない | ヘッダフィールドにもグリッドセルにもエラーハイライトの仕組みがない |
| バリデーションルールが Spec に宣言されていない | ルールがハンドラのコード内に散在し、画面間で共通化できない |

---

## 設計方針

### バリデーションの 2 層構造

```
┌────────────────────────────────────────┐
│  フロント側バリデーション（保存前チェック） │
│  ・Spec に宣言されたルールを実行          │
│  ・エラーがあれば保存を中断しフィールド表示 │
├────────────────────────────────────────┤
│  サーバ側バリデーション（API 400 エラー）   │
│  ・API が返すフィールドごとのエラーを解析   │
│  ・フロントと同じ表示方法でフィールドに紐づけ│
└────────────────────────────────────────┘
```

どちらの層も、最終的に同じ形式のエラーオブジェクトに変換し、同じ UI で表示する。

### エラーオブジェクトの型

```typescript
export type FieldError = {
  /** エラー対象のフィールド ID（ヘッダ: field id、グリッド: `${rowIndex}:${colId}` ） */
  fieldKey: string
  /** エラーメッセージ */
  message: string
}

export type ValidationResult = {
  valid: boolean
  errors: FieldError[]
}
```

### Spec に宣言するバリデーションルール

```typescript
export type ValidationRule =
  | { type: 'required'; message?: string }
  | { type: 'minLength'; value: number; message?: string }
  | { type: 'maxLength'; value: number; message?: string }
  | { type: 'pattern'; regex: string; message?: string }
  | { type: 'custom'; validate: (value: unknown) => string | null }
```

`HeaderFieldSpec` と列定義に `validation` プロパティを追加する：

```typescript
export type HeaderFieldSpec = {
  // ... 既存のプロパティ
  validation?: ValidationRule[]
}
```

---

## 作業手順

### ステップ 1: バリデーション型を定義

**対象**: 新規ファイル `src/features/screen-engine/validation/validationTypes.ts`

上記の `FieldError`, `ValidationResult`, `ValidationRule` を定義する。

**完了基準**:
- [ ] 型がエクスポートされている
- [ ] `npm run build` が成功する

---

### ステップ 2: `HeaderFieldSpec` に `validation` を追加

**対象**: `src/features/screen-engine/screenSpecTypes.ts`

```typescript
export type HeaderFieldSpec = {
  id: string
  label: string
  editorType: HeaderEditorType
  placeholder?: string
  gridColumnSpan?: number
  optionsRef?: 'parties'
  defaultDatePlusDays?: number
  validation?: ValidationRule[]  // 追加
}
```

**完了基準**:
- [ ] `HeaderFieldSpec` に `validation` プロパティが追加されている
- [ ] 既存コードが壊れない（`validation` はオプショナル）
- [ ] `npm run build` が成功する

---

### ステップ 3: 共通バリデーション実行関数を作成

**対象**: 新規ファイル `src/features/screen-engine/validation/validateFields.ts`

`executeRule` はステップ 4（グリッドバリデーション）でも使うため **エクスポート** する。

```typescript
import type { HeaderFieldSpec } from '../screenSpecTypes'
import type { FieldError, ValidationResult, ValidationRule } from './validationTypes'

/**
 * 1 つのルールを値に適用し、エラーメッセージまたは null を返す。
 * ヘッダ・グリッド両方から利用するためエクスポートする。
 */
export function executeRule(
  rule: ValidationRule,
  value: unknown,
  label: string,
): string | null {
  switch (rule.type) {
    case 'required': {
      // masterCombobox の値は { code, name } | null。
      // code が空文字の場合も「未選択」として扱う。
      const empty = value == null
        || (typeof value === 'string' && value.trim() === '')
        || (typeof value === 'object' && value !== null && 'code' in value && !(value as { code?: string }).code)
      return empty ? (rule.message ?? `${label}は必須です`) : null
    }
    case 'minLength': {
      const s = String(value ?? '')
      return s.length < rule.value
        ? (rule.message ?? `${label}は${rule.value}文字以上で入力してください`)
        : null
    }
    case 'maxLength': {
      const s = String(value ?? '')
      return s.length > rule.value
        ? (rule.message ?? `${label}は${rule.value}文字以下で入力してください`)
        : null
    }
    case 'pattern': {
      const s = String(value ?? '')
      return !new RegExp(rule.regex).test(s)
        ? (rule.message ?? `${label}の形式が正しくありません`)
        : null
    }
    case 'custom':
      return rule.validate(value)
  }
}

/**
 * ヘッダフィールドの値をバリデーションし、エラーの配列を返す。
 */
export function validateHeaderFields(
  fields: readonly HeaderFieldSpec[],
  values: Record<string, unknown>,
): ValidationResult {
  const errors: FieldError[] = []

  for (const field of fields) {
    if (!field.validation) continue
    const value = values[field.id]
    for (const rule of field.validation) {
      const message = executeRule(rule, value, field.label)
      if (message) {
        errors.push({ fieldKey: field.id, message })
        break // 1フィールドにつき最初のエラーだけ
      }
    }
  }

  return { valid: errors.length === 0, errors }
}
```

**完了基準**:
- [ ] `executeRule` と `validateHeaderFields` がエクスポートされている
- [ ] 各ルールタイプ（`required`, `minLength`, `maxLength`, `pattern`, `custom`）が実装されている
- [ ] `required` は `CodeMasterItem | null`（masterCombobox の値）にも対応している
- [ ] `npm run build` が成功する

---

### ステップ 4: 明細グリッドのバリデーション関数を作成

**対象**: 新規ファイル `src/features/screen-engine/validation/validateGridRows.ts`

ステップ 3 でエクスポートした `executeRule` をインポートして使う。

```typescript
import type { FieldError, ValidationResult, ValidationRule } from './validationTypes'
import { executeRule } from './validateFields'

export type GridColumnValidation = {
  colId: string
  label: string
  validation: ValidationRule[]
}

/**
 * グリッドの行データをバリデーションし、エラーの配列を返す。
 * fieldKey は `${rowIndex}:${colId}` の形式。
 */
export function validateGridRows(
  rows: Record<string, unknown>[],
  columns: GridColumnValidation[],
  isRowFilled: (row: Record<string, unknown>) => boolean,
): ValidationResult {
  const errors: FieldError[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (!isRowFilled(row)) continue // 空行はスキップ
    for (const col of columns) {
      for (const rule of col.validation) {
        const message = executeRule(rule, row[col.colId], col.label)
        if (message) {
          errors.push({ fieldKey: `${i}:${col.colId}`, message })
          break
        }
      }
    }
  }

  return { valid: errors.length === 0, errors }
}
```

**完了基準**:
- [ ] `validateGridRows` がエクスポートされている
- [ ] `executeRule` を `validateFields.ts` からインポートしている
- [ ] 空行がスキップされる
- [ ] `fieldKey` が `rowIndex:colId` 形式で出力される

---

### ステップ 5: 受注 Spec にバリデーションルールを追加

**対象**: `src/features/order-screen/orderNewSpec.ts`

```typescript
export const ORDER_HEADER_FIELDS: HeaderFieldSpec[] = [
  {
    id: 'contractParty',
    label: '契約先コード',
    editorType: 'masterCombobox',
    optionsRef: 'parties',
    placeholder: '例: 1001',
    validation: [{ type: 'required' }],  // 追加
  },
  {
    id: 'deliveryParty',
    label: '納入先コード',
    editorType: 'masterCombobox',
    optionsRef: 'parties',
    placeholder: '例: 3001',
    validation: [{ type: 'required' }],  // 追加
  },
  // ... 他のフィールドは任意
]
```

**完了基準**:
- [ ] 受注ヘッダの契約先・納入先に `required` バリデーションが追加されている
- [ ] `npm run build` が成功する

---

### ステップ 5b: マークダウン仕様書にバリデーション列を追加

**対象**: `docs/screen-specs/order-new.md`, `docs/screen-specs/purchase-new.md`

TypeScript Spec にバリデーションルールを追加するのと同じタイミングで、マークダウン仕様書にも反映する。
後回しにすると抜け漏れが起きやすいため、Spec 変更と同時に実施する。

**`order-new.md` ヘッダテーブルの変更例**:

```markdown
| 項目 | 入力方式 | バリデーション | 備考 |
|------|---------|--------------|------|
| 契約先コード | マスタ選択（取引先） | 必須 | |
| 納入先コード | マスタ選択（取引先） | 必須 | |
| 納入場所 | テキスト | — | |
| 納期 | 日付 | — | 未入力時は今日+7日を初期値 |
| 内示番号 | テキスト | — | 横幅 span 2 |
| 備考 | テキスト | — | `order-new` では Enter 順に含む。`order-new-alt` では Enter 順から除外 |
```

**完了基準**:
- [ ] `order-new.md` のヘッダ・明細テーブルに「バリデーション」列が追加されている
- [ ] `purchase-new.md` も同様に更新されている（現時点ではバリデーション未定義なら「—」）
- [ ] TypeScript Spec のルールとマークダウンの記載が一致している

---

### ステップ 6: 保存前バリデーションの組み込み

**対象**: `src/views/OrderNewPage.vue` の `handleSave`（発注画面は `src/views/PurchaseNewPage.vue`）

> **注意**: 以前の設計で参照していた `ScreenWorkspaceView.vue` は C-view-refactor で廃止され、現在は存在しない。
> 保存ロジックは各画面の Page コンポーネント（`OrderNewPage.vue`, `PurchaseNewPage.vue`）に直接ある。

保存ハンドラの先頭でバリデーションを実行し、エラーがあれば保存を中断する。

**`orderHeader` の型に関する注意**: `orderHeader` は `reactive({...})` で定義されており、`contractParty` / `deliveryParty` の値は `CodeMasterItem | null`（`{ code: string, name: string } | null`）。ステップ 3 の `executeRule` の `required` チェックは、この構造（`'code' in value` で code が空文字かどうか）に対応している。

```typescript
async function handleSave() {
  // 1. フロント側バリデーション
  const headerResult = validateHeaderFields(spec.headerFields, orderHeader)
  const gridResult = validateGridRows(
    snapshotOrderRowsFromGrid(),
    ORDER_GRID_VALIDATIONS,
    isOrderLineFilled,
  )

  const allErrors = [...headerResult.errors, ...gridResult.errors]
  if (allErrors.length > 0) {
    validationErrors.value = allErrors  // エラー状態を ref に格納
    return  // 保存中断
  }

  validationErrors.value = []  // エラークリア

  // 2. API 呼び出し（既存コード）
  try {
    const result = await createOrder(...)
    // ...
  } catch (e) {
    // 3. API 400 エラーの解析（ステップ 7b）
  }
}
```

**完了基準**:
- [ ] `OrderNewPage.vue` の `handleSave` 先頭でバリデーションが実行される
- [ ] エラーがあれば保存が中断される
- [ ] エラー状態が `validationErrors` ref に格納される
- [ ] `PurchaseNewPage.vue` にも同様の仕組みを適用できる構造になっている

---

### ステップ 7: API 400 エラーの解析とフィールド紐づけ

**対象**: 新規ファイル `src/features/screen-engine/validation/parseApiErrors.ts`

API が 400 を返したとき、レスポンスボディからフィールドごとのエラーに変換する。

#### API エラーレスポンスの契約（✅ 合意済み）

バックエンドとの合意形成（Q1〜Q5）を経て、以下の形式で **確定** した。

```json
{
  "code": "VALIDATION_ERROR",
  "message": "入力値に誤りがあります",
  "details": [
    { "field": "contractPartyCode", "reason": "契約先コードは必須です" },
    { "field": "lines[0].productCode", "reason": "製品コードは必須です" }
  ]
}
```

| プロパティ | 型 | 説明 |
|---|---|---|
| `code` | `string` | エラー種別コード。バリデーションエラーは `"VALIDATION_ERROR"` |
| `message` | `string` | 人間向けの概要メッセージ |
| `details` | `{ field, reason }[]` | フィールドごとのエラー。業務ルール違反で特定フィールドに紐づかない場合は空配列 |
| `details[].field` | `string` | Spring の `FieldError.getField()` パス（例: `contractPartyCode`, `lines[0].productCode`） |
| `details[].reason` | `string` | エラーメッセージ（Bean Validation の `message` 属性から取得） |

#### メッセージ文言の出所（✅ 合意済み）

API 400 のフィールドエラーメッセージは **バックエンドの `reason` を正** とする。
フロント側のバリデーション（ステップ 3）は独自にメッセージを生成するが、API エラー時は `reason` をそのまま表示する。
バックエンド側で Bean Validation の `message` 属性に日本語を設定済み（Q4 で合意）。

#### 業務ルール 400（`details` が空）の扱い（✅ 合意済み）

サービス層で投げる業務エラー（例: 金額不一致、存在しない取引先コード）は `code: "BAD_REQUEST"` + `details: []`（空配列）で返される（Q3 で合意）。
この場合は `message` を **グローバルメッセージ** としてヘッダフィールド上部またはスナックバーに表示する。

```typescript
export type ApiErrorResponse = {
  code: string
  message: string
  details: { field: string; reason: string }[]
}

/**
 * API の 400 レスポンスを FieldError[] に変換する。
 * details が空の場合（業務ルールエラー）は message をグローバルエラーとして返す。
 */
export function parseApiErrors(
  apiErrors: ApiErrorResponse,
  fieldMapping?: Record<string, string>,
): { fieldErrors: FieldError[]; globalMessage: string | null } {
  if (apiErrors.details.length === 0) {
    return { fieldErrors: [], globalMessage: apiErrors.message }
  }

  const fieldErrors = apiErrors.details.map((d) => ({
    fieldKey: fieldMapping?.[d.field] ?? d.field,
    message: d.reason,
  }))

  return { fieldErrors, globalMessage: null }
}
```

#### フィールド名マッピングテーブ（`ORDER_FIELD_MAPPING`）

API の `field` と Spec の `fieldKey` は名前が異なる。全項目の対応を明示する。

```typescript
export const ORDER_FIELD_MAPPING: Record<string, string> = {
  // ヘッダ
  contractPartyCode: 'contractParty',
  deliveryPartyCode: 'deliveryParty',
  deliveryLocation:  'deliveryLocation',
  dueDate:           'dueDate',
  forecastNumber:    'forecastNumber',
  // 明細（lines[N].xxx → N:colId に変換するため、別途パース処理が必要）
}
```

> 明細のフィールドパスは `lines[0].productCode` のような形式で来る。
> これを `0:productCode` に変換するヘルパーを `parseApiErrors` 内に含める。

```typescript
function mapFieldPath(
  path: string,
  mapping: Record<string, string>,
): string {
  // lines[N].xxx → N:xxx
  const lineMatch = path.match(/^lines\[(\d+)]\.(.+)$/)
  if (lineMatch) {
    return `${lineMatch[1]}:${lineMatch[2]}`
  }
  return mapping[path] ?? path
}
```

**完了基準**:
- [ ] `ApiErrorResponse` 型がバックエンド現行形式（`code`, `message`, `details[].field`, `details[].reason`）と一致している
- [ ] `parseApiErrors` がフィールドエラーとグローバルメッセージの両方を返す
- [ ] `ORDER_FIELD_MAPPING` でヘッダ全項目のマッピングが定義されている
- [ ] 明細の `lines[N].xxx` パスが `N:colId` に変換される

---

### ステップ 7b: API クライアントの 400 レスポンスボディ取得対応

**対象**: `src/api/client.ts`

現在の `createOrder` は `!res.ok` で一律 `throw new Error(...)` しており、400 レスポンスのボディを読まない。
ステップ 7 の `parseApiErrors` を活用するため、400 のときにレスポンスボディを取得してスローする仕組みが必要。

**実装方針**:

```typescript
import type { ApiErrorResponse } from '@/features/screen-engine/validation/parseApiErrors'

export class ApiValidationError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiErrorResponse,
  ) {
    super(`Validation failed: ${status}`)
    this.name = 'ApiValidationError'
  }
}

export async function createOrder(body: OrderCreateRequest): Promise<OrderCreateResponse> {
  const url = `${baseUrl}/api/orders`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    if (res.status === 400) {
      const errorBody = await res.json()
      throw new ApiValidationError(res.status, errorBody as ApiErrorResponse)
    }
    throw new Error(`createOrder failed: ${res.status}`)
  }
  return (await res.json()) as OrderCreateResponse
}
```

呼び出し側（`OrderNewPage.vue` の `handleSave`）では：

```typescript
} catch (e) {
  if (e instanceof ApiValidationError) {
    const { fieldErrors, globalMessage } = parseApiErrors(e.body, ORDER_FIELD_MAPPING)
    if (fieldErrors.length > 0) {
      validationErrors.value = fieldErrors
    }
    if (globalMessage) {
      alert(globalMessage)  // 将来はスナックバーに置き換え
    }
    return
  }
  // その他のエラーは従来通り
  console.error('受注登録失敗:', e)
  alert('受注の登録に失敗しました。コンソールを確認してください。')
}
```

#### 対象 API のスコープ

現時点では **`POST /api/orders`（createOrder）** のみを対象とする。
`ApiValidationError` クラスは汎用的に設計しているため、将来 `PUT /api/orders/:id` や他画面の保存 API にも同じパターンで適用できる。
他の API への適用は、その API の実装タイミングで行う。

**完了基準**:
- [ ] `ApiValidationError` クラスが定義・エクスポートされている
- [ ] `ApiErrorResponse` 型が現行バックエンド形式（`code`, `message`, `details`）を使っている
- [ ] `createOrder` が 400 レスポンスのボディを取得して `ApiValidationError` をスローする
- [ ] `handleSave` の catch で `ApiValidationError` を判定し、フィールドエラー **と** グローバルメッセージの両方を処理できる

---

### ステップ 8: ヘッダフィールドのエラー表示 UI

**対象**: `src/components/ScreenHeaderField.vue` および `src/components/MasterCombobox.vue`

エラーがあるフィールドにハイライトとメッセージを表示する。

**実装方針**:

#### ScreenHeaderField.vue

- props に `error?: string` を追加
- エラーがある場合:
  - `text` / `date` 入力要素に赤い枠線（`border-color: #dc2626`）
  - 入力要素の下にエラーメッセージ（赤字、12px）
- `masterCombobox` の場合は `MasterCombobox` に `error` を伝搬する

#### MasterCombobox.vue

- props に `error?: string` を追加
- エラーがある場合:
  - 入力要素に赤い枠線と `aria-invalid="true"`
  - 入力要素の下にエラーメッセージ
- エラーがない場合: 通常表示

**表示イメージ**:

```
契約先コード
┌──────────────────────┐
│ （未選択）            │  ← 赤い枠線
└──────────────────────┘
  契約先コードは必須です    ← 赤い文字
```

**完了基準**:
- [ ] `ScreenHeaderField` に `error` props が追加されている
- [ ] `MasterCombobox` にも `error` props が追加され、`ScreenHeaderField` から伝搬される
- [ ] エラーがある場合に赤い枠線とメッセージが表示される（全エディタタイプ共通）
- [ ] エラーがない場合は通常表示

---

### ステップ 9: グリッドセルのエラー表示

**対象**: AG Grid の `cellStyle` または `cellClass`

エラーがあるセルにハイライトを表示する。

**実装方針**:
- `validationErrors` ref から該当セルのエラーを検索
- エラーがあるセルに `cellStyle` で背景色を変更（例: `background: #fef2f2`）
- または `cellClass` でクラスを付与し、CSS でスタイリング
- セルにマウスホバーでツールチップにエラーメッセージを表示（`tooltipValueGetter`）

```typescript
function getValidationCellStyle(params: CellClassParams): CellStyle | null {
  const key = `${params.node.rowIndex}:${params.column.getColId()}`
  const error = validationErrors.value.find((e) => e.fieldKey === key)
  if (error) {
    return { background: '#fef2f2', borderBottom: '2px solid #dc2626' }
  }
  return null
}
```

**完了基準**:
- [ ] エラーのあるセルにハイライトが表示される
- [ ] ツールチップでエラーメッセージが確認できる

---

### ステップ 10: 結合テスト

**完了条件**:
- [ ] 必須項目（契約先コード）が空のまま保存すると、該当フィールドに赤枠 + エラーメッセージが表示される
- [ ] 明細の必須項目が空のまま保存すると、該当セルにハイライトが表示される
- [ ] エラーを修正して再保存すると、エラー表示が消える
- [ ] API が 400 を返したとき、フィールドごとのエラーが表示される
- [ ] バリデーションルールは Spec に宣言でき、画面ごとにカスタマイズ可能
- [ ] 発注画面にも同じ仕組みで `required` を追加でき、同じ UI で表示される
- [ ] `npm run build` が成功する

---

## 参考ファイル

| ファイル | 役割 |
|---|---|
| `src/features/screen-engine/screenSpecTypes.ts` | `HeaderFieldSpec` にバリデーションを追加 |
| `src/features/order-screen/orderNewSpec.ts` | 受注 Spec にルールを追加 |
| `src/components/ScreenHeaderField.vue` | エラー表示 UI の追加先 |
| `src/components/MasterCombobox.vue` | masterCombobox のエラー表示 UI の追加先 |
| `src/views/OrderNewPage.vue` | 受注登録の `handleSave` にバリデーション組み込み |
| `src/views/PurchaseNewPage.vue` | 発注登録の `handleSave` にバリデーション組み込み |
| `src/api/client.ts` | 400 レスポンスボディ取得対応・`ApiValidationError` 追加 |
| `docs/screen-specs/order-new.md` | バリデーション列をマークダウン仕様書に反映 |
| `docs/screen-specs/purchase-new.md` | バリデーション列をマークダウン仕様書に反映 |

---

## リスクと判断ポイント

| リスク | 対策 | 状態 |
|---|---|---|
| ~~API エラーレスポンスの形式が未確定~~ | `{ code, message, details: [{ field, reason }] }` 形式で合意確定（Q1〜Q5 全項目合意） | **解決済み** |
| `custom` ルールがシリアライズ不可 | `custom` は関数を含むため、Markdown 定義からの自動生成には向かない。手動で TypeScript に書く前提 | 受容 |
| グリッドセルのエラー表示が全セルの `cellStyle` を毎回評価する | パフォーマンスが問題になる場合は、エラーのある行だけ `refreshCells` する最適化を検討 | 監視 |
| バリデーションエラーの多言語対応 | 現時点では日本語固定。将来 i18n が必要になったらメッセージを外出しする | 受容 |

---

## バックエンド側の対応（✅ 合意済み）

D のフロント実装に合わせて、Spring Boot 側で必要な対応。合意形成（Q1〜Q5）で全項目合意済み。

### 現状（確認済み）

- `GlobalExceptionHandler`（`@RestControllerAdvice`）で `MethodArgumentNotValidException` をハンドリングし、`{ code, message, details: [{ field, reason }] }` 形式で 400 を返す仕組みが**実装済み**（Q1 で確認）
- Bean Validation アノテーション（`@NotBlank`, `@NotEmpty`, `@Valid`）が `OrderCreateRequest` / `OrderLineRequest` に**付与済み**（Q1 で確認）

### 合意に基づく対応状況

#### 1. バリデーションメッセージの日本語化 — **対応済み**

フロントは `reason` の文字列をそのまま UI に表示する。
バックエンド側で Bean Validation の `message` 属性に日本語メッセージを設定済み（Q4 で合意）。

```java
// 実装は record（コンポーネント名が JSON プロパティ名になる点は class と同様）
public record OrderCreateRequest(
    @NotBlank(message = "契約先コードは必須です") String contractPartyCode,
    @NotBlank(message = "納入先コードは必須です") String deliveryPartyCode,
    String deliveryLocation,
    LocalDate dueDate,
    String forecastNumber,
    @NotEmpty(message = "明細は1行以上必要です") @Valid List<OrderLineRequest> lines
) {}

public record OrderLineRequest(
    @NotBlank(message = "製品コードは必須です") String productCode,
    String productName,
    @NotNull(message = "数量は必須です") @Positive(message = "数量は1以上の整数を入力してください") Integer quantity,
    @NotNull(message = "単価は必須です") @Positive(message = "単価は1以上の整数を入力してください") Integer unitPrice,
    @NotNull(message = "金額は必須です") Integer amount
) {}
```

#### 2. `details[].field` のパス形式 — **確認済み**

- ヘッダ項目: `contractPartyCode`, `deliveryPartyCode` など
- ネストした明細: `lines[0].productCode`, `lines[1].quantity` など

Q2 で確認済み。フロントの `mapFieldPath` の変換ロジックと整合する。

#### 3. 業務ルールエラーの `details` 形式 — **合意済み**

- `code: "BAD_REQUEST"` + `details: []` + `message` に理由文言
- フロントは `details` が空の場合、`message` をグローバルメッセージとして表示

Q3 で合意済み。

---

## フロント⇔バックエンド 合意形成

このセクションは、バリデーション実装に必要な **API 400 レスポンスの仕様** をフロント・バック間で確定するためのものです。

### 進め方

1. **フロント** が確認事項（Q1〜Q5）と提案を記載 ← **済み**
2. **バックエンド** が各 Q の「バックエンド回答」欄に記入し、返却 ← **済み**
3. **フロント** が回答を確認し、ステータスを「✅ 合意」に変更 ← **済み（全 Q 合意）**
4. **バックエンド** が最終確認し、全 Q が「✅ 合意」になれば確定 ← **済み（本リポジトリの `GlobalExceptionHandler` / DTO と文面一致を確認）**

---

### Q1: 400 レスポンスの JSON 形式

**ステータス**: ✅ 合意

**フロントの理解**:

バックエンドからの報告に基づき、現行の 400 レスポンスボディは以下の形式と理解している。

```json
{
  "code": "VALIDATION_ERROR",
  "message": "入力値に誤りがあります",
  "details": [
    { "field": "contractPartyCode", "reason": "契約先コードは必須です" },
    { "field": "lines[0].productCode", "reason": "製品コードは必須です" }
  ]
}
```

**フロントの提案**: この形式に合わせて `ApiErrorResponse` 型を定義する。

**バックエンドへの確認**:
1. 上記の JSON が現行の実際のレスポンスと一致しているか？
2. プロパティ名（`code`, `message`, `details`, `field`, `reason`）は正確か？
3. `code` に入る値のバリエーション（`"VALIDATION_ERROR"` 以外に何があるか？）

**バックエンド回答**:

1. **一致している。** 実装は `ApiErrorResponse`（`code`, `message`, `details`）で、`details` の各要素は `FieldErrorDetail(field, reason)` が JSON では `field` / `reason` になる。HTTP ステータスは **400**。
2. **プロパティ名は上記どおり正確**（Jackson のデフォルトで record コンポーネント名がそのままプロパティ名になる）。
3. **`code` のバリエーション（本プロジェクト現状）**
   - **`VALIDATION_ERROR`** … `MethodArgumentNotValidException`（Bean Validation 違い）。`details` に 1 件以上の `{ field, reason }` が入る想定。
   - **`BAD_REQUEST`** … `ResponseStatusException` で HTTP 400 を返した場合（受注サービスの業務ルールなど）。現状 **`details` は空配列 `[]`**、`message` に理由文言。
   - その他（参考）: **`NOT_FOUND`**（404）、**`CONFLICT`**（409・楽観ロック）、**`HTTP_<status>`**（上記以外の `ResponseStatusException`）。いずれも主に `details` は空。

**補足**: フロントが `POST /api/orders` の 400 のみを扱う場合、`code` は **`VALIDATION_ERROR` または `BAD_REQUEST`** のどちらかが来る想定でよい。

---

### Q2: `details[].field` のパス形式

**ステータス**: ✅ 合意

**フロントの理解**:

Spring の `FieldError.getField()` から取得されるパスで、以下の形式を想定している。

| パターン | 例 | フロントでの変換先 |
|---|---|---|
| ヘッダ項目 | `contractPartyCode` | → `ORDER_FIELD_MAPPING` で `contractParty` に変換 |
| ネスト明細 | `lines[0].productCode` | → 正規表現で `0:productCode` に変換 |

**バックエンドへの確認**:
1. 実際に `POST /api/orders` に空の `contractPartyCode` を送ったとき、`details[].field` にはどういう文字列が入るか？
2. 明細の `@Valid` + `@NotBlank` で `lines[0].productCode` のようなパスが返るか？
3. カスタムバリデータを使う場合、パスの形式は変わるか？

**できれば**: 実際の 400 レスポンスの curl 結果をここに貼ってもらえると確実。

```bash
# 例: 空リクエストでの 400 レスポンス
curl -s -X POST http://localhost:8080/api/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"contractPartyCode":"","deliveryPartyCode":"","lines":[]}' | jq .
```

**バックエンド回答**:

1. **`contractPartyCode` が空文字**のリクエストでは、`details[].field` は Spring の `FieldError.getField()` どおり **`contractPartyCode`**（先頭のドットなしの単純名）。
2. **明細**は `@Valid` + ネストされた `OrderLineRequest` のため、パスは **`lines[0].productCode`**, **`lines[0].quantity`** の形式になる（インデックスは 0 始まり）。フロントの `lines[N].xxx` → `N:colId` 変換と整合する。
3. **現状カスタムバリデータは未使用**（標準アノテーションのみ）。将来追加しても、Spring が生成するパス規則に従う想定。

**curl 例の期待結果（概略）**  
`{"contractPartyCode":"","deliveryPartyCode":"","lines":[]}` を送ると、少なくとも `lines` に対する `@NotEmpty` と、空文字の `@NotBlank` が効き、`details` に複数要素が入る。`field` は `contractPartyCode`, `deliveryPartyCode`, `lines` など（実際の組み合わせはバインディング順に依存しうる）。

---

### Q3: 業務ルールエラー（サービス層 400）の扱い

**ステータス**: ✅ 合意

**フロントの提案**:

| ケース | `details` | フロントの表示 |
|---|---|---|
| Bean Validation エラー | `[{ field, reason }, ...]` | 各フィールドに紐づけて赤枠 + メッセージ |
| 業務エラー（フィールド特定可） | `[{ field, reason }]` | 同上 |
| 業務エラー（フィールド特定不可） | `[]`（空配列） | `message` をグローバルメッセージとして表示 |

**バックエンドへの確認**:
1. サービス層で 400 を返すケースは現状あるか？（例: 存在しない取引先コード、金額不一致など）
2. その場合の `details` の形式は？（空配列？ フィールドを含む？）
3. 上記のフロント提案で問題ないか？

**バックエンド回答**:

1. **ある。** `OrderService#createOrder` などで `ResponseStatusException(HttpStatus.BAD_REQUEST, "…")` を投げている（例: 明細が空、製品コード空、数量×単価と金額不一致、本日採番上限など）。
2. **その場合の JSON** は `code`: **`BAD_REQUEST`**、`message`: **例外に渡した理由文言**、`details`: **`[]`（空配列）**。`VALIDATION_ERROR` とは別コードになる点に注意。
3. **フロント提案で問題ない。** `details` が空のときは `message` をグローバル表示する運用で整合する。将来的に業務エラーを特定セルに紐づけたくなった場合は、バックエンドで `details` に擬似パスを載せる拡張を別途合意すればよい。

---

### Q4: エラーメッセージの文言と出所

**ステータス**: ✅ 合意

**フロントの提案**:

- API 400 のフィールドエラーメッセージは **バックエンドの `reason` をそのまま UI に表示** する
- フロント側では加工・翻訳しない
- したがって、`@NotBlank(message = "契約先コードは必須です")` のようにユーザ向け日本語を設定してほしい

**バックエンドへの確認**:
1. 現在の `message` 属性はユーザ向けの日本語になっているか？（Spring デフォルトの英語のままか？）
2. フロントがそのまま表示する前提で問題ないか？
3. 以下のメッセージ例で良いか？

| フィールド | 想定メッセージ |
|---|---|
| `contractPartyCode` | 契約先コードは必須です |
| `deliveryPartyCode` | 納入先コードは必須です |
| `lines` (空) | 明細は1行以上必要です |
| `lines[N].productCode` | 製品コードは必須です |

**バックエンド回答**:

1. **合意前は一部デフォルト英語の可能性があったが、合意に合わせて対応済み。** `OrderCreateRequest` / `OrderLineRequest` の Bean Validation に **日本語 `message` を付与**した（リポジトリの Java ソース参照）。
2. **`reason` をそのまま UI 表示する前提で問題ない**（サーバがユーザ向け文言を返す責務とする）。
3. **提示の表は次のとおり反映済み／対応関係**  
   - `contractPartyCode` → 「契約先コードは必須です」  
   - `deliveryPartyCode` → 「納入先コードは必須です」  
   - `lines` 空 → 「明細は1行以上必要です」  
   - `lines[N].productCode` → 「製品コードは必須です」  
   加えて明細の数量・単価・金額にも日本語メッセージを付与（`@NotNull` / `@Positive`）。

**補足**: 業務ルール由来の `BAD_REQUEST` の `message` は `ResponseStatusException` の reason 文字列（実装内の日本語）となる。

---

### Q5: 対象 API のスコープ

**ステータス**: ✅ 合意

**フロントの提案**:

- 今回の対象は **`POST /api/orders`（受注新規登録）** のみ
- `ApiValidationError` / `parseApiErrors` は汎用設計なので、将来の `PUT` や他画面にも適用可能
- 他 API への適用はその実装タイミングで行う

**バックエンドへの確認**:
1. 上記スコープで良いか？
2. 近い将来、同じ 400 形式で追加される API の予定はあるか？

**バックエンド回答**:

1. **スコープは問題ない。** 今回の API 契約の議論は **`POST /api/orders`（受注新規登録）** に限定してよい。
2. **近い将来の予定**  
   - 同一形式をそのまま流用しやすいのは、例として **受注の更新 `PUT`（未実装）** や、他画面の **POST** で Bean Validation + 同一 `GlobalExceptionHandler` を使う場合。実装時に再度フィールドパスとマッピングを確認すればよい。  
   - **`GET` / `DELETE` の 404** は `code`: `NOT_FOUND`、`details` 空の `ApiErrorResponse` だが、HTTP は **404** なのでフロントの「400 専用」ハンドラとは別扱いでよい。

---

### 合意ステータス一覧

| # | 確認事項 | ステータス |
|---|---------|----------|
| Q1 | 400 レスポンスの JSON 形式 | ✅ 合意 |
| Q2 | `details[].field` のパス形式 | ✅ 合意 |
| Q3 | 業務ルールエラーの扱い | ✅ 合意 |
| Q4 | エラーメッセージの文言と出所 | ✅ 合意 |
| Q5 | 対象 API のスコープ | ✅ 合意 |

**全 Q が ✅ 合意 となった。ステップ 7/7b を含む全ステップの実装に着手可能。**
