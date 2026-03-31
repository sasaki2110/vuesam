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

**API エラーレスポンスの想定形式**:

```json
{
  "status": 400,
  "errors": [
    { "field": "contractPartyCode", "message": "契約先コードは必須です" },
    { "field": "lines[0].productCode", "message": "製品コードは必須です" }
  ]
}
```

```typescript
export type ApiErrorResponse = {
  status: number
  errors: { field: string; message: string }[]
}

/**
 * API の 400 レスポンスを FieldError[] に変換する。
 * フィールド名のマッピング（API のフィールド名 → Spec のフィールド ID）が必要。
 */
export function parseApiErrors(
  apiErrors: ApiErrorResponse,
  fieldMapping?: Record<string, string>,
): FieldError[] {
  return apiErrors.errors.map((e) => ({
    fieldKey: fieldMapping?.[e.field] ?? e.field,
    message: e.message,
  }))
}
```

**完了基準**:
- [ ] `parseApiErrors` がエクスポートされている
- [ ] API のフィールド名から Spec のフィールド ID にマッピングできる

---

### ステップ 7b: API クライアントの 400 レスポンスボディ取得対応

**対象**: `src/api/client.ts`

現在の `createOrder` は `!res.ok` で一律 `throw new Error(...)` しており、400 レスポンスのボディを読まない。
ステップ 7 の `parseApiErrors` を活用するため、400 のときにレスポンスボディを取得してスローする仕組みが必要。

**実装方針**:

```typescript
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
      throw new ApiValidationError(res.status, errorBody)
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
    validationErrors.value = parseApiErrors(e.body, ORDER_FIELD_MAPPING)
    return
  }
  // その他のエラーは従来通り
  console.error('受注登録失敗:', e)
  alert('受注の登録に失敗しました。コンソールを確認してください。')
}
```

**完了基準**:
- [ ] `ApiValidationError` クラスが定義・エクスポートされている
- [ ] `createOrder` が 400 レスポンスのボディを取得して `ApiValidationError` をスローする
- [ ] `handleSave` の catch で `ApiValidationError` を判定し、フィールドエラーに変換できる

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

| リスク | 対策 |
|---|---|
| API エラーレスポンスの形式が未確定 | Phase 1 のバックエンドでは 400 のボディ形式を定義していない。Spring Boot のデフォルト（`MethodArgumentNotValidException`）を使うか、カスタムエラー形式を定義するか決める必要がある |
| `custom` ルールがシリアライズ不可 | `custom` は関数を含むため、Markdown 定義からの自動生成には向かない。手動で TypeScript に書く前提 |
| グリッドセルのエラー表示が全セルの `cellStyle` を毎回評価する | パフォーマンスが問題になる場合は、エラーのある行だけ `refreshCells` する最適化を検討 |
| バリデーションエラーの多言語対応 | 現時点では日本語固定。将来 i18n が必要になったらメッセージを外出しする |

---

## バックエンド側の対応（参考）

D のフロント実装に合わせて、Spring Boot 側でも以下の対応が望ましい：

### API 400 エラーレスポンスの統一形式

```java
@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(
            MethodArgumentNotValidException ex) {
        List<Map<String, String>> errors = ex.getBindingResult()
            .getFieldErrors().stream()
            .map(fe -> Map.of(
                "field", fe.getField(),
                "message", fe.getDefaultMessage()
            ))
            .toList();
        return ResponseEntity.badRequest().body(Map.of(
            "status", 400,
            "errors", errors
        ));
    }
}
```

### エンティティへのバリデーションアノテーション

```java
public class OrderCreateRequest {
    @NotBlank(message = "契約先コードは必須です")
    private String contractPartyCode;

    @NotBlank(message = "納入先コードは必須です")
    private String deliveryPartyCode;

    @NotEmpty(message = "明細は1行以上必要です")
    private List<OrderLineRequest> lines;
}
```
