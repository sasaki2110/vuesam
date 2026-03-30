# B: 一覧画面の構成

## 目的

受注一覧画面を作り、**検索条件 → 結果一覧 → 行操作（変更画面遷移・削除）** の業務フローを実現する。登録画面とは別の画面パターンの土台を作り、今後の一覧画面（発注一覧、製品一覧など）の横展開を容易にする。

---

## 一覧画面の特徴（登録画面との違い）

| 観点 | 登録画面（既存） | 一覧画面（新規） |
|------|-----------------|-----------------|
| ヘッダ部 | データとしてのヘッダ（受注の契約先、納期など） | 検索条件（絞り込み用の入力項目） |
| グリッド | 編集可能な明細入力 | 読み取り専用の検索結果一覧（または行選択のみ） |
| 行操作 | 最終行 Enter で行追加 | ダブルクリック → 変更画面遷移、選択 → 削除 |
| 保存 | F12 で API に POST | なし（検索・遷移・削除が主操作） |
| ページネーション | なし（固定行数 + 追加） | 全件取得（H2 開発段階では十分） |

---

## 設計方針

### 新しいシェル Vue を作る

- 登録画面の `ScreenWorkspaceView.vue` とは**別のシェル Vue** を作る（例: `ListScreenView.vue`）
- ただし、以下は登録画面と**共通で再利用**する：
  - field type レジストリ（`editorRegistry.ts`）— ヘッダの検索条件描画に使用
  - F キー基盤（`useKeySpec`）
  - API クライアントパターン（`src/api/client.ts`）
  - ヘッダフィールド描画（`ScreenHeaderField.vue`）

### 一覧画面用の Spec 型を定義

既存の `OrderScreenSpec` / `PurchaseScreenSpec` とは別に、一覧画面用の Spec 型を定義する。

```typescript
export type ListScreenSpec = {
  id: string
  title: string
  /** 検索条件のヘッダフィールド（HeaderFieldSpec を流用） */
  searchFields: HeaderFieldSpec[]
  /** 結果一覧の列定義 */
  resultColumns: ListResultColumn[]
  /** 行ダブルクリック時の遷移先ルート設定 */
  rowNavigation: {
    routeName: string
    paramField: string // 行データから取得するパラメータのフィールド名
  }
  /** 削除 API の設定（null なら削除ボタンなし） */
  deleteAction: {
    apiPath: string // 例: '/api/orders' → DELETE /api/orders/{id}
    idField: string // 行データから取得する ID フィールド名
    confirmMessage: string
  } | null
  /** 検索 API の設定 */
  searchAction: {
    apiPath: string // 例: '/api/orders' → GET /api/orders?key=value
  }
  navigationSpec: NavigationSpec
  keySpec: KeySpec
}

export type ListResultColumn = {
  field: string
  headerName: string
  width?: number
  /** 表示フォーマット（'date', 'number', 'text'） */
  format?: 'date' | 'number' | 'text'
}
```

---

## 作業手順

### ステップ 1: 一覧画面用の Spec 型を定義

**対象**: `src/features/screen-engine/screenSpecTypes.ts`

上記の `ListScreenSpec` と `ListResultColumn` を追加する。

**ポイント**:
- 検索条件の `searchFields` は既存の `HeaderFieldSpec` をそのまま流用する
- `resultColumns` は読み取り専用なので、`editable` / `fieldType` は不要。表示フォーマットだけ持つ
- `rowNavigation` と `deleteAction` は一覧画面固有の操作を宣言する

**完了基準**:
- [ ] `ListScreenSpec` 型が `screenSpecTypes.ts` にエクスポートされている
- [ ] `ListResultColumn` 型が `screenSpecTypes.ts` にエクスポートされている
- [ ] `npm run build` が成功する

---

### ステップ 2: `ListScreenView.vue` を作成

**対象**: 新規ファイル `src/views/ListScreenView.vue`

一覧画面の共通シェルを作成する。

**レイアウト構成**:

```
┌──────────────────────────────────────────────────┐
│ ヘッダバー: タイトル + [検索] ボタン              │
├──────────────────────────────────────────────────┤
│ 検索条件エリア（ScreenHeaderField で描画）         │
│ ┌──────┐ ┌──────┐ ┌──────┐                      │
│ │項目1 │ │項目2 │ │項目3 │  ...                  │
│ └──────┘ └──────┘ └──────┘                      │
├──────────────────────────────────────────────────┤
│ ツールバー: [削除] ボタン + 件数表示              │
├──────────────────────────────────────────────────┤
│ AG Grid（読み取り専用、行選択モード）              │
│ │ 受注番号 │ 契約先 │ 納入先 │ 納期 │ 金額合計 │  │
│ │ ORD-001  │ ○○商事│ 関東.. │ 4/6  │ 310,000 │  │
│ │ ORD-002  │ ...   │ ...   │ ...  │ ...     │  │
└──────────────────────────────────────────────────┘
```

**実装ポイント**:

- `ListScreenSpec` を props（または `resolveListScreenBundle()` で取得）として受け取る
- 検索条件は `ScreenHeaderField` を `v-for` で描画（登録画面と同じ仕組み）
- AG Grid は `readOnly` モード（`:editable="false"` / `:single-click-edit="false"`）
- 行選択は `rowSelection: 'multiple'`（チェックボックス付き）
- 行ダブルクリック → `router.push` で変更画面に遷移
- 削除ボタン → 選択行の ID を取得 → 確認ダイアログ → DELETE API

**完了基準**:
- [ ] `ListScreenView.vue` が作成されている
- [ ] 検索条件エリアと結果グリッドが描画される
- [ ] 行ダブルクリックで遷移ロジックが動作する
- [ ] 削除ボタンで確認ダイアログが表示される

---

### ステップ 3: 受注一覧の Spec を作成

**対象**: 新規ファイル `src/features/order-screen/orderListSpec.ts`

```typescript
import type { ListScreenSpec } from '@/features/screen-engine/screenSpecTypes'

export const ORDER_LIST_SPEC: ListScreenSpec = {
  id: 'order-list',
  title: '受注一覧',
  searchFields: [
    {
      id: 'orderNumber',
      label: '受注番号',
      editorType: 'text',
      placeholder: '例: ORD-2026',
    },
    {
      id: 'contractParty',
      label: '契約先',
      editorType: 'masterCombobox',
      optionsRef: 'parties',
    },
    {
      id: 'dueDateFrom',
      label: '納期（From）',
      editorType: 'date',
    },
    {
      id: 'dueDateTo',
      label: '納期（To）',
      editorType: 'date',
    },
  ],
  resultColumns: [
    { field: 'orderNumber', headerName: '受注番号', width: 180 },
    { field: 'contractPartyName', headerName: '契約先', width: 180 },
    { field: 'deliveryPartyName', headerName: '納入先', width: 180 },
    { field: 'dueDate', headerName: '納期', width: 120, format: 'date' },
    { field: 'totalAmount', headerName: '金額合計', width: 140, format: 'number' },
    { field: 'createdAt', headerName: '登録日時', width: 160, format: 'date' },
  ],
  rowNavigation: {
    routeName: 'order-edit',
    paramField: 'id',
  },
  deleteAction: {
    apiPath: '/api/orders',
    idField: 'id',
    confirmMessage: '選択した受注を削除しますか？',
  },
  searchAction: {
    apiPath: '/api/orders',
  },
  navigationSpec: {
    headerEnterOrder: ['orderNumber', 'contractParty', 'dueDateFrom', 'dueDateTo'],
    gridEntryColumnField: 'orderNumber',
    gridEditChainColIds: [],
    gridEnterStopEditingColIds: [],
  },
  keySpec: {
    // F1 で検索条件クリア、F12 で検索実行（一覧画面用のキーバインド）
  },
}
```

**完了基準**:
- [ ] `orderListSpec.ts` が作成されている
- [ ] `ORDER_LIST_SPEC` がエクスポートされている
- [ ] `npm run build` が成功する

---

### ステップ 4: バックエンドに一覧 API と削除 API を追加

**対象**: Spring Boot バックエンド

#### GET /api/orders — 受注一覧取得

**リクエスト**: クエリパラメータで検索条件を受け取る。

```
GET /api/orders?orderNumber=ORD-2026&contractPartyCode=1001&dueDateFrom=2026-01-01&dueDateTo=2026-12-31
```

すべてのパラメータは任意。未指定なら全件取得。

**レスポンス**: `200 OK`

```json
[
  {
    "id": 1,
    "orderNumber": "ORD-20260330-001",
    "contractPartyCode": "1001",
    "contractPartyName": "〇〇商事",
    "deliveryPartyCode": "3001",
    "deliveryPartyName": "関東物流センター",
    "deliveryLocation": "第2倉庫",
    "dueDate": "2026-04-06",
    "forecastNumber": "FC-2026-001",
    "totalAmount": 310000,
    "lineCount": 2,
    "createdAt": "2026-03-30T10:00:00"
  }
]
```

**実装方針**:
- `OrderHeaderRepository` にクエリメソッドを追加（`@Query` または Specification パターン）
- `totalAmount` は明細の `amount` を合算して返す
- `contractPartyName` / `deliveryPartyName` は `Party` エンティティから JOIN で取得
- ソート順は `createdAt` 降順（新しい順）

#### DELETE /api/orders/{id} — 受注削除

**リクエスト**: パスパラメータで受注 ID を指定。

```
DELETE /api/orders/1
```

**レスポンス**: `204 No Content`

**実装方針**:
- ヘッダと明細を `@Transactional` で一括削除
- 存在しない ID の場合は `404 Not Found`

**完了基準**:
- [ ] `GET /api/orders` が受注一覧を JSON 配列で返す
- [ ] クエリパラメータで絞り込みが動作する
- [ ] `DELETE /api/orders/{id}` が受注を削除する
- [ ] JWT 認証が必須

---

### ステップ 5: フロントに API 関数を追加

**対象**: `src/api/client.ts`

```typescript
export type OrderListItem = {
  id: number
  orderNumber: string
  contractPartyCode: string
  contractPartyName: string
  deliveryPartyCode: string
  deliveryPartyName: string
  deliveryLocation: string
  dueDate: string
  forecastNumber: string
  totalAmount: number
  lineCount: number
  createdAt: string
}

export type OrderSearchParams = {
  orderNumber?: string
  contractPartyCode?: string
  dueDateFrom?: string
  dueDateTo?: string
}

export async function fetchOrders(params?: OrderSearchParams): Promise<OrderListItem[]> {
  const query = new URLSearchParams()
  if (params?.orderNumber) query.set('orderNumber', params.orderNumber)
  if (params?.contractPartyCode) query.set('contractPartyCode', params.contractPartyCode)
  if (params?.dueDateFrom) query.set('dueDateFrom', params.dueDateFrom)
  if (params?.dueDateTo) query.set('dueDateTo', params.dueDateTo)
  const qs = query.toString()
  const url = `${baseUrl}/api/orders${qs ? '?' + qs : ''}`
  const res = await fetch(url, { headers: authHeader() })
  if (!res.ok) throw new Error(`fetchOrders failed: ${res.status}`)
  return (await res.json()) as OrderListItem[]
}

export async function deleteOrder(id: number): Promise<void> {
  const url = `${baseUrl}/api/orders/${id}`
  const res = await fetch(url, { method: 'DELETE', headers: authHeader() })
  if (!res.ok) throw new Error(`deleteOrder failed: ${res.status}`)
}
```

**完了基準**:
- [ ] `fetchOrders` と `deleteOrder` が `client.ts` にエクスポートされている
- [ ] 型定義が正しい
- [ ] `npm run build` が成功する

---

### ステップ 6: ルートを追加

**対象**: `src/router/index.ts`

```typescript
{
  path: '/orders',
  name: 'order-list',
  component: ListScreenView,
  meta: { requiresAuth: true, screenSpecId: 'order-list' },
},
```

**完了基準**:
- [ ] `/orders` でルーティングが解決される
- [ ] 認証ガードが適用されている

---

### ステップ 7: 画面定義 Markdown の書き方を拡張

**対象**: `docs/screen-engine-roadmap/phase4.md`

一覧画面テンプレートを追加する。

```markdown
## 画面: ＜画面名＞一覧

- **画面 ID**: `<screen-id>-list`
- **ルート**: `/<resource>`

### 検索条件

| 項目 | 入力方式 | 備考 |
|------|---------|------|
| ...  | ...     | ...  |

### 結果一覧

| 列名 | 表示形式 | 備考 |
|------|---------|------|
| ...  | ...     | ...  |

### 行操作

- ダブルクリック → ＜遷移先画面＞
- 削除 → DELETE ＜APIパス＞

### 検索 API

| アクション | API | パラメータ概要 | レスポンス概要 |
|-----------|-----|--------------|--------------|
| 検索 | GET ＜APIパス＞ | ＜クエリパラメータ＞ | ＜レスポンス＞ |
```

**完了基準**:
- [ ] `phase4.md` に一覧画面テンプレートが追加されている

---

### ステップ 8: 受注一覧の画面定義 Markdown を作成

**対象**: 新規ファイル `docs/screen-specs/order-list.md`

受注一覧の画面定義を Markdown で記述する（上記テンプレートに従う）。

**完了基準**:
- [ ] `docs/screen-specs/order-list.md` が作成されている

---

### ステップ 9: 結合テスト

**完了条件**:
- [ ] `/orders` で受注一覧が表示される
- [ ] 検索条件を入力して一覧を絞り込める
- [ ] 行ダブルクリックで変更画面に遷移できる（遷移先が未実装なら 404 でもよい）
- [ ] 行を選択して削除できる（確認ダイアログ → 削除 → 一覧更新）
- [ ] `npm run build` が成功する

---

## 参考ファイル

| ファイル | 役割 |
|---|---|
| `src/views/ScreenWorkspaceView.vue` | 登録画面の参考（丸コピーはしない） |
| `src/features/screen-engine/screenSpecTypes.ts` | Spec 型の追加先 |
| `src/api/client.ts` | API クライアントの追加先 |
| `src/router/index.ts` | ルートの追加先 |
| `docs/api-integration-roadmap/phase1-backend.md` | 既存の API 仕様（エンティティ定義を参照） |

---

## リスクと判断ポイント

| リスク | 対策 |
|---|---|
| 変更画面（受注編集）がまだない | 一覧画面のダブルクリック遷移先は `order-edit` ルートとして定義しておき、変更画面は後で実装する |
| 検索条件が複雑になる | H2 開発段階では全件取得 + フロント絞り込みでもよい。バックエンド検索は段階的に充実させる |
| ページネーションが必要になる | H2 では全件取得で十分。件数が増えたら `limit` / `offset` パラメータを追加する |
