# 受注変更画面の実装

## 目的

受注一覧画面から選択した受注を読み込み、ヘッダ・明細を編集して更新保存する画面を実装する。これは本基盤における初の **更新系画面** であり、新規登録画面との差分パターン（データ読み込み → 編集 → PUT）を確立する。

---

## 現状

- 受注一覧（`ListScreenView.vue` + `orderListSpec.ts`）は **ダブルクリック → `order-edit` ルート** への遷移を既に持つ
- ルート `/orders/:id/edit`（`name: 'order-edit'`）は存在するが、プレースホルダ（`OrderEditPlaceholderView.vue`）
- 新規登録画面（`OrderNewPage.vue`）が完成しており、これをテンプレートに差分だけ実装する

---

## 新規登録との差分（設計判断）

| 観点 | 新規登録 (`OrderNewPage`) | 変更 (`OrderEditPage`) |
|------|--------------------------|------------------------|
| 初期状態 | 空のヘッダ + 空行 18 本 | API から読み込んだデータで埋まったヘッダ + 既存明細行 |
| 保存 API | `POST /api/orders` | `PUT /api/orders/{id}` |
| ヘッダに受注番号表示 | なし | 読み取り専用で受注番号を表示 |
| F1（新規）の挙動 | ヘッダ・明細をクリア | **使わない**（一覧に戻るか、無効化） |
| 明細の行追加 | 最終行 Enter で追加 | 同じ（追加可能） |
| 明細の行削除 | 不要（空行のまま残せばよい） | 将来検討（本ステップでは不要） |
| バリデーション | 同じルール | 同じルール（Spec を共有） |
| CommitRule | 同じ | 同じ（Spec を共有） |
| 一覧からの遷移起点 | — | F10 押下 or ダブルクリック |

**設計方針**: `OrderNewPage.vue` を **コピーして差分を実装** する。
Spec（`orderNewSpec.ts`）、CommitRule（`orderCommitRules.ts`）、列定義ビルダ（`buildColumnsBySpec`）は **そのまま共有** する。

---

## 一覧画面からの遷移方法

### F10 キーによる遷移（新規追加）

一覧画面で行を選択し、F10 を押すと変更画面に遷移する。

**必要な変更:**

1. **`KeyActionId` に `'edit'` を追加**（`screenSpecTypes.ts`）

```typescript
export type KeyActionId = 'new' | 'save' | 'mockAlert' | 'search' | 'clearSearch' | 'edit'
```

2. **`orderListSpec.ts` の `keySpec` に F10 を追加**

```typescript
keySpec: {
  F1: 'clearSearch',
  F10: 'edit',
  F12: 'search',
},
```

3. **`ListScreenView.vue` に `edit` ハンドラを追加**

```typescript
function handleEdit() {
  const api = gridApi.value
  if (!api) return
  const rows = api.getSelectedRows()
  if (rows.length === 0) {
    alert('変更する行を選択してください。')
    return
  }
  const param = spec.value.rowNavigation.paramField
  const raw = rows[0][param]
  if (raw == null) return
  void router.push({
    name: spec.value.rowNavigation.routeName,
    params: { id: String(raw) },
  })
}

useKeySpec(
  () => spec.value.keySpec,
  {
    search: runSearch,
    clearSearch,
    edit: handleEdit,
  },
)
```

4. **ツールバーに「変更（F10）」ボタンを追加**

一覧画面のツールバー（削除ボタンの隣）に変更ボタンを表示する。

> **ダブルクリック遷移はそのまま残す**。F10 と ダブルクリックの両方で遷移できる。

---

## 実装ステップ

### ステップ 1: バックエンド API の実装

変更画面に必要な 2 つの API を実装する。

**バックエンド方針（確定）**

- **(A) GET の `productName`**: 明細に保存されている `productName` カラムの値をそのまま返す。`products` マスタとの JOIN による上書き・補完は行わない。
- **(B) マスタ存在チェック**: 契約先コード・納入先コード・製品コードについて、取引先／製品マスタへの存在確認は行わない（`POST /api/orders` と同様。PUT のみ厳格化しない）。

#### 1-1: 受注取得 API — `GET /api/orders/{id}`

| 項目 | 内容 |
|------|------|
| メソッド | `GET` |
| パス | `/api/orders/{id}` |
| 認証 | `Authorization: Bearer {token}` |
| レスポンス | `OrderDetailResponse`（下記） |
| 404 | 該当する受注がない場合 |

**レスポンス型:**

```json
{
  "id": 1,
  "orderNumber": "ORD-2026-0001",
  "contractPartyCode": "1001",
  "deliveryPartyCode": "3001",
  "deliveryLocation": "第2倉庫",
  "dueDate": "2026-04-15",
  "forecastNumber": "FC-001",
  "lines": [
    {
      "lineId": 10,
      "lineNo": 1,
      "productCode": "A001",
      "productName": "ネジM3",
      "quantity": 100,
      "unitPrice": 50,
      "amount": 5000
    },
    {
      "lineId": 11,
      "lineNo": 2,
      "productCode": "B002",
      "productName": "板金パネル",
      "quantity": 20,
      "unitPrice": 300,
      "amount": 6000
    }
  ]
}
```

**TypeScript 型（`client.ts` に追加）:**

```typescript
export type OrderDetailResponse = {
  id: number
  orderNumber: string
  contractPartyCode: string
  deliveryPartyCode: string
  deliveryLocation: string | null
  dueDate: string | null
  forecastNumber: string | null
  lines: {
    lineId: number
    lineNo: number
    productCode: string
    productName: string | null
    quantity: number
    unitPrice: number
    amount: number
  }[]
}
```

**Spring Boot 実装のポイント:**

- 受注ヘッダを ID で 1 件取得し、関連する受注明細を読み込む（`lineNo` 昇順）
- 明細の `productName` は **保存カラムのみ**（方針 (A)）。マスタ JOIN は不要
- 存在しない `id` の場合は `404 Not Found`

```java
@GetMapping("/api/orders/{id}")
public ResponseEntity<OrderDetailResponse> getOrder(@PathVariable Long id) {
    return orderRepository.findById(id)
        .map(order -> ResponseEntity.ok(toDetailResponse(order)))
        .orElse(ResponseEntity.notFound().build());
}
```

#### 1-2: 受注更新 API — `PUT /api/orders/{id}`

| 項目 | 内容 |
|------|------|
| メソッド | `PUT` |
| パス | `/api/orders/{id}` |
| 認証 | `Authorization: Bearer {token}` |
| リクエスト | `OrderUpdateRequest`（下記） |
| レスポンス | `OrderUpdateResponse`（下記） |
| 400 | バリデーションエラー（POST と同じ JSON 契約） |
| 404 | 該当する受注がない場合 |

**リクエスト型:**

```json
{
  "contractPartyCode": "1001",
  "deliveryPartyCode": "3001",
  "deliveryLocation": "第2倉庫",
  "dueDate": "2026-04-15",
  "forecastNumber": "FC-001",
  "lines": [
    {
      "productCode": "A001",
      "productName": "ネジM3",
      "quantity": 100,
      "unitPrice": 50,
      "amount": 5000
    },
    {
      "productCode": "C003",
      "productName": "ボルトM8",
      "quantity": 50,
      "unitPrice": 80,
      "amount": 4000
    }
  ]
}
```

> リクエストボディは `POST /api/orders` と **同一構造**（`OrderCreateRequest`）。
> 明細は **洗い替え**（既存明細を全削除し、送信された `lines` で再作成）。

**レスポンス型:**

```json
{
  "orderId": 1,
  "orderNumber": "ORD-2026-0001",
  "message": "受注を更新しました"
}
```

> レスポンスも `OrderCreateResponse` と同一構造。

**TypeScript 型（`client.ts` に追加）:**

```typescript
export type OrderUpdateRequest = OrderCreateRequest

export type OrderUpdateResponse = {
  orderId: number
  orderNumber: string
  message: string
}
```

**Spring Boot 実装のポイント:**

- `findById` で受注ヘッダを取得。なければ `404`
- バリデーション: `OrderCreateRequest` と同じ Bean Validation を再利用
- 契約先・納入先・製品コードの **マスタ存在チェックは行わない**（方針 (B)、POST と同様）
- トランザクション内で:
  1. ヘッダ項目を更新
  2. 既存明細を `DELETE WHERE order_id = ?`
  3. 新しい明細を `INSERT`（`lineNo` はリクエスト配列の順番で 1 始まりの連番）
- レスポンスは更新後の `orderId` / `orderNumber` / `message`

**400 エラーのフォーマット**: POST と同じ。`field` パスも同一規約。

```java
@PutMapping("/api/orders/{id}")
@Transactional
public ResponseEntity<?> updateOrder(
        @PathVariable Long id,
        @Valid @RequestBody OrderCreateRequest request) {
    var order = orderRepository.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    // ヘッダ更新
    order.setContractPartyCode(request.contractPartyCode());
    order.setDeliveryPartyCode(request.deliveryPartyCode());
    // ...
    // 明細洗い替え
    orderLineRepository.deleteByOrderId(id);
    for (int i = 0; i < request.lines().size(); i++) {
        var line = request.lines().get(i);
        orderLineRepository.save(new OrderLine(order, i + 1, line));
    }
    return ResponseEntity.ok(new OrderUpdateResponse(
        order.getId(), order.getOrderNumber(), "受注を更新しました"));
}
```

---

### ステップ 2: フロントエンド基盤の変更

#### 2-1: `KeyActionId` に `'edit'` を追加

**ファイル**: `src/features/screen-engine/screenSpecTypes.ts`

```typescript
// 変更前
export type KeyActionId = 'new' | 'save' | 'mockAlert' | 'search' | 'clearSearch'

// 変更後
export type KeyActionId = 'new' | 'save' | 'mockAlert' | 'search' | 'clearSearch' | 'edit'
```

#### 2-2: 受注一覧 Spec に F10 を追加

**ファイル**: `src/features/order-screen/orderListSpec.ts`

```typescript
// 変更前
keySpec: {
  F1: 'clearSearch',
  F12: 'search',
},

// 変更後
keySpec: {
  F1: 'clearSearch',
  F10: 'edit',
  F12: 'search',
},
```

#### 2-3: `ListScreenView.vue` に `edit` ハンドラを追加

**ファイル**: `src/views/ListScreenView.vue`

`useKeySpec` の handlers に `edit` を追加し、選択行のデータで `rowNavigation` に遷移する。
ツールバーに「変更（F10）」ボタンを追加する。

**完了条件**:
- 一覧で行を選択 → F10 → `/orders/:id/edit` に遷移
- 選択なしで F10 → 「変更する行を選択してください。」のアラート
- 「変更（F10）」ボタンをツールバーに表示

---

### ステップ 3: API クライアント関数の追加

**ファイル**: `src/api/client.ts`

以下の 2 関数と型を追加する。

```typescript
export type OrderDetailResponse = {
  id: number
  orderNumber: string
  contractPartyCode: string
  deliveryPartyCode: string
  deliveryLocation: string | null
  dueDate: string | null
  forecastNumber: string | null
  lines: {
    lineId: number
    lineNo: number
    productCode: string
    productName: string | null
    quantity: number
    unitPrice: number
    amount: number
  }[]
}

export async function fetchOrder(id: number): Promise<OrderDetailResponse> {
  const url = `${baseUrl}/api/orders/${id}`
  const res = await fetch(url, { headers: getAuthHeaders() })
  if (!res.ok) throw new Error(`fetchOrder failed: ${res.status}`)
  return (await res.json()) as OrderDetailResponse
}

export type OrderUpdateRequest = OrderCreateRequest

export async function updateOrder(
  id: number,
  body: OrderUpdateRequest,
): Promise<OrderCreateResponse> {
  const url = `${baseUrl}/api/orders/${id}`
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    if (res.status === 400) {
      try {
        const errorBody = (await res.json()) as ApiErrorResponse
        throw new ApiValidationError(res.status, errorBody)
      } catch (e) {
        if (e instanceof ApiValidationError) throw e
        throw new Error(`updateOrder failed: ${res.status}`)
      }
    }
    throw new Error(`updateOrder failed: ${res.status}`)
  }
  return (await res.json()) as OrderCreateResponse
}
```

**完了条件**: `npm run build` で型エラーなし。

---

### ステップ 4: 受注変更ページの実装

**ファイル**: `src/views/OrderEditPage.vue`（新規作成）

`OrderNewPage.vue` をコピーし、以下の差分を実装する。

#### 4-1: ルートパラメータから受注 ID を取得

```typescript
const route = useRoute()
const orderId = computed(() => Number(route.params.id))
```

#### 4-2: `onMounted` でデータを読み込む

```typescript
const orderNumber = ref('')
const isLoading = ref(true)

onMounted(() => {
  void (async () => {
    try {
      const [p, pr] = await Promise.all([fetchParties(), fetchProducts()])
      parties.value = p
      products.value = pr
    } catch (e) {
      console.error('マスタ取得失敗:', e)
      parties.value = [...MOCK_PARTIES]
      products.value = [...MOCK_PRODUCTS]
    }

    try {
      const detail = await fetchOrder(orderId.value)
      orderNumber.value = detail.orderNumber

      // ヘッダにセット（masterCombobox は { code, name } オブジェクト）
      orderHeader.contractParty =
        parties.value.find((p) => p.code === detail.contractPartyCode) ?? null
      orderHeader.deliveryParty =
        parties.value.find((p) => p.code === detail.deliveryPartyCode) ?? null
      orderHeader.deliveryLocation = detail.deliveryLocation ?? ''
      orderHeader.dueDate = detail.dueDate ?? ''
      orderHeader.forecastNumber = detail.forecastNumber ?? ''

      // 明細にセット
      const rows: OrderLineRow[] = detail.lines.map((l) => ({
        lineNo: l.lineNo,
        productCode: l.productCode,
        productName: l.productName ?? '',
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        amount: l.amount,
      }))
      // 空行を追加して新規と同じ操作性にする
      const maxLineNo = rows.length > 0 ? Math.max(...rows.map((r) => r.lineNo)) : 0
      const emptyCount = Math.max(0, INITIAL_ROWS - rows.length)
      for (let i = 0; i < emptyCount; i++) {
        rows.push({
          lineNo: maxLineNo + i + 1,
          productCode: '',
          productName: '',
          quantity: 0,
          unitPrice: 0,
          amount: 0,
        })
      }
      orderRowData.value = rows
    } catch (e) {
      console.error('受注取得失敗:', e)
      alert('受注データの取得に失敗しました。一覧に戻ります。')
      void router.push({ name: 'order-list' })
    } finally {
      isLoading.value = false
    }
  })()
})
```

#### 4-3: タイトルに受注番号を含める

```typescript
const pageTitle = computed(() =>
  orderNumber.value ? `受注変更（${orderNumber.value}）` : '受注変更',
)
```

テンプレートの `title` prop に `pageTitle` を渡す。

#### 4-4: `handleSave` を PUT に変更

```typescript
async function handleSave() {
  // バリデーションは新規と同一（コピー）
  // ...

  try {
    const result = await updateOrder(orderId.value, {
      contractPartyCode: ...,
      deliveryPartyCode: ...,
      deliveryLocation: ...,
      dueDate: ...,
      forecastNumber: ...,
      lines,
    })
    alert(`受注を更新しました（受注番号: ${result.orderNumber}）`)
  } catch (e) {
    // エラーハンドリングは新規と同一
  }
}
```

#### 4-5: F1（新規）の挙動を変更

変更画面では F1 を **一覧に戻る** に割り当てるか、**無効化** する。

**案 A: 一覧に戻る**

```typescript
function handleBackToList() {
  void router.push({ name: 'order-list' })
}

useKeySpec(
  () => ({ ...spec.value.keySpec, F1: undefined }), // F1 のデフォルト 'new' を無効化
  {
    save: handleSave,
    mockAlert: onMockF8,
  },
)
```

ヘッダの「新規（F01）」ボタンを「一覧へ戻る」に変更する。

**案 B: RegistrationScreenShell に戻るボタンを追加**

シェルに `backRoute` prop を追加し、設定されていれば「新規（F01）」の代わりに「← 一覧」を表示。

> **推奨: 案 A**（シェルの変更を最小限にするため、ページ側で制御）。
> ただし、RegistrationScreenShell のボタン文言変更が必要。
> → **シェルに `newButtonLabel` と `onNew` の emit を使い分ける** のが最もシンプル。

**本ステップでの実装**: ヘッダの「新規（F01）」ボタンを非表示にし、
代わりに「← 一覧」ボタンを置く。シェルの `@new` emit で `router.push({ name: 'order-list' })` を呼ぶ。

#### 4-6: Spec の共有

変更画面は `orderNewSpec.ts` のリソースをそのまま使う。新しい Spec 型は不要。

| 共有するもの | ファイル |
|---|---|
| `ORDER_HEADER_FIELDS` | `orderNewSpec.ts` |
| `ORDER_GRID_VALIDATIONS` | `orderNewSpec.ts` |
| `buildColumnsBySpec` | `orderNewSpec.ts` |
| `createNextOrderRow` / `isOrderLineFilled` | `orderNewSpec.ts` |
| `orderCommitRules` | `orderCommitRules.ts` |
| `ORDER_FIELD_MAPPING` | `parseApiErrors.ts` |
| `NavigationSpec` | `orderNewSpec.ts`（`ORDER_NEW_SPEC.navigationSpec`） |

**完了条件**:
- `/orders/:id/edit` でデータが読み込まれ、ヘッダ・明細が表示される
- 明細を編集して F12 で `PUT /api/orders/{id}` が呼ばれる
- バリデーションエラーが新規と同じように表示される
- F10（一覧から）と ダブルクリック（一覧から）で遷移できる

---

### ステップ 5: ルーティングの更新

**ファイル**: `src/router/index.ts`

```typescript
// 変更前
import OrderEditPlaceholderView from '@/views/OrderEditPlaceholderView.vue'

// 変更後
import OrderEditPage from '@/views/OrderEditPage.vue'

// ルート定義
{
  path: '/orders/:id/edit',
  name: 'order-edit',
  component: OrderEditPage,   // ← プレースホルダから差し替え
  meta: { requiresAuth: true },
},
```

**完了条件**: プレースホルダが置き換わり、変更画面が表示される。

---

### ステップ 6: プレースホルダの削除

**ファイル**: `src/views/OrderEditPlaceholderView.vue` を削除。

---

### ステップ 7: ビルド確認と動作テスト

```bash
npm run build
```

**動作確認チェックリスト**:

- [ ] 受注一覧で行を選択 → F10 → 変更画面に遷移
- [ ] 受注一覧でダブルクリック → 変更画面に遷移
- [ ] 変更画面にヘッダ（契約先、納入先、納期など）がセットされている
- [ ] 変更画面に明細行がセットされている
- [ ] 変更画面のタイトルに受注番号が表示されている
- [ ] ヘッダの値を変更して F12 → 保存成功
- [ ] 明細の値を変更して F12 → 保存成功
- [ ] 新しい明細行を追加して F12 → 保存成功
- [ ] Enter ナビゲーション（ヘッダ → グリッド → 次行）が動作する
- [ ] 必須項目を空にして F12 → バリデーションエラーが赤枠で表示
- [ ] API が 400 を返す → フィールドにエラーが表示
- [ ] 存在しない受注 ID でアクセス → アラート + 一覧に戻る
- [ ] 一覧に戻るボタン（F01 相当）が動作する
- [ ] `npm run build` が成功する

---

## バックエンド API まとめ

### 新規実装が必要な API

| # | メソッド | パス | 説明 |
|---|---------|------|------|
| 1 | `GET` | `/api/orders/{id}` | 受注詳細取得（ヘッダ + 明細） |
| 2 | `PUT` | `/api/orders/{id}` | 受注更新（ヘッダ + 明細の洗い替え） |

### 既存 API（変更不要）

| メソッド | パス | 説明 |
|---------|------|------|
| `GET` | `/api/orders` | 受注一覧検索 |
| `POST` | `/api/orders` | 受注新規登録 |
| `DELETE` | `/api/orders/{id}` | 受注削除 |
| `GET` | `/api/masters/parties` | 取引先マスタ |
| `GET` | `/api/masters/products` | 製品マスタ |

### GET /api/orders/{id} — 詳細

```
Request:  なし
Response (200):
{
  "id": number,
  "orderNumber": "string",
  "contractPartyCode": "string",
  "deliveryPartyCode": "string",
  "deliveryLocation": "string | null",
  "dueDate": "yyyy-MM-dd | null",
  "forecastNumber": "string | null",
  "lines": [
    {
      "lineId": number,
      "lineNo": number,
      "productCode": "string",
      "productName": "string | null",
      "quantity": number,
      "unitPrice": number,
      "amount": number
    }
  ]
}
Response (404): 該当受注なし
```

### PUT /api/orders/{id} — 更新

```
Request:
{
  "contractPartyCode": "string",
  "deliveryPartyCode": "string",
  "deliveryLocation": "string",
  "dueDate": "yyyy-MM-dd",
  "forecastNumber": "string",
  "lines": [
    {
      "productCode": "string",
      "productName": "string",
      "quantity": number,
      "unitPrice": number,
      "amount": number
    }
  ]
}
Response (200):
{
  "orderId": number,
  "orderNumber": "string",
  "message": "受注を更新しました"
}
Response (400): POST と同じ JSON 契約
Response (404): 該当受注なし
```

---

## フロントエンド変更ファイル一覧

| 操作 | ファイル | 内容 |
|------|---------|------|
| **変更** | `src/features/screen-engine/screenSpecTypes.ts` | `KeyActionId` に `'edit'` 追加 |
| **変更** | `src/features/order-screen/orderListSpec.ts` | `keySpec` に `F10: 'edit'` 追加 |
| **変更** | `src/views/ListScreenView.vue` | `edit` ハンドラ + ツールバーボタン追加 |
| **変更** | `src/api/client.ts` | `fetchOrder` / `updateOrder` / 型追加 |
| **変更** | `src/router/index.ts` | `OrderEditPage` に差し替え |
| **新規** | `src/views/OrderEditPage.vue` | 変更画面（`OrderNewPage.vue` ベース） |
| **削除** | `src/views/OrderEditPlaceholderView.vue` | プレースホルダを除去 |

---

## 手引書への影響

この実装が完了したら、以下のドキュメントを更新する。

| ドキュメント | 更新内容 |
|---|---|
| `docs/guide-for-humans.md` | 「2.3 変更画面」セクションを追加。登録画面との違いを説明 |
| `docs/guide-for-ai.md` | 「変更画面の実装手順」セクションを追加。新規との差分パターンを記載 |
| `docs/screen-specs/order-edit.md` | 受注変更の画面定義 Markdown を新規作成 |

---

## 将来の拡張ポイント

本ステップでは対応しないが、将来検討する項目:

1. **楽観的排他制御**（`version` / `updatedAt` を使った競合検知）
2. **明細行の個別削除**（行選択 → 削除キー or コンテキストメニュー）
3. **変更履歴の表示**（受注の変更ログ）
4. **ステータス管理**（確定済み受注は変更不可など）
5. **変更画面から新規登録への切替**（F1 で新規モードに切り替え）
