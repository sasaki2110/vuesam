# Phase 1: バックエンド API 実装（Spring Boot）

## 目的

受注登録画面が必要とする **マスタ取得 API 3本** と **受注新規登録 API 1本** を Spring Boot で実装する。

---

## 前提・技術スタック

| 項目 | 内容 |
|------|------|
| フレームワーク | Spring Boot（既存プロジェクト） |
| ORM | **Spring Data JPA** |
| データベース | **H2 Database**（インメモリまたはファイルモード。開発用途で十分） |
| 認証 | 既存の JWT（`POST /api/auth/login` → Bearer トークン）。マスタ・受注 API はすべて認証必須（`/api/**`） |
| CORS | 既存設定のまま（`http://localhost:5173` を許可） |

---

## データモデル（エンティティ）

### 取引先マスタ（`Party`）

| カラム | 型 | 制約 | 備考 |
|--------|-----|------|------|
| id | Long | PK, auto | |
| code | String | unique, not null | 取引先コード（例: `1001`） |
| name | String | not null | 取引先名（例: `〇〇商事`） |

### 製品マスタ（`Product`）

| カラム | 型 | 制約 | 備考 |
|--------|-----|------|------|
| id | Long | PK, auto | |
| code | String | unique, not null | 製品コード（例: `B001`） |
| name | String | not null | 製品名（例: `リチウムセルL型`） |

### 受注ヘッダ（`OrderHeader`）

| カラム | 型 | 制約 | 備考 |
|--------|-----|------|------|
| id | Long | PK, auto | |
| orderNumber | String | unique, not null | 受注番号（サーバ側で自動採番） |
| contractPartyCode | String | not null | 契約先コード |
| deliveryPartyCode | String | not null | 納入先コード |
| deliveryLocation | String | | 納入場所 |
| dueDate | LocalDate | | 納期 |
| forecastNumber | String | | 内示番号 |
| createdAt | LocalDateTime | not null | 登録日時（サーバ側で自動設定） |

### 受注明細（`OrderLine`）

| カラム | 型 | 制約 | 備考 |
|--------|-----|------|------|
| id | Long | PK, auto | |
| orderHeader | OrderHeader | FK (ManyToOne), not null | 親ヘッダ |
| lineNo | Integer | not null | 行番号（1〜） |
| productCode | String | not null | 製品コード |
| productName | String | | 製品名（登録時点のスナップショット） |
| quantity | Integer | not null | 数量 |
| unitPrice | Integer | not null | 単価 |
| amount | Integer | not null | 金額（= quantity × unitPrice） |

---

## 初期データ（`data.sql` または `CommandLineRunner`）

H2 起動時にマスタの初期データを投入する。フロントの現行モックデータ（`src/constants/mockData.ts`）と同じ内容を入れる。

### 取引先マスタ

```sql
INSERT INTO party (code, name) VALUES ('1001', '〇〇商事');
INSERT INTO party (code, name) VALUES ('2001', '△△電池工業');
INSERT INTO party (code, name) VALUES ('3001', '関東物流センター');
INSERT INTO party (code, name) VALUES ('1002', '自動車部品ホールディングス');
INSERT INTO party (code, name) VALUES ('2002', '極板製造所横浜');
INSERT INTO party (code, name) VALUES ('3002', '西日本バッテリー販売');
INSERT INTO party (code, name) VALUES ('1003', 'グリーンモビリティ部品');
INSERT INTO party (code, name) VALUES ('2003', '解体リサイクル化工');
INSERT INTO party (code, name) VALUES ('3003', '中部セル流通基地');
INSERT INTO party (code, name) VALUES ('1004', '東洋エネルギー商事');
```

### 製品マスタ

```sql
INSERT INTO product (code, name) VALUES ('B001', 'リチウムセルL型');
INSERT INTO product (code, name) VALUES ('B002', '鉛蓄電池パック');
INSERT INTO product (code, name) VALUES ('B003', '電解液ユニット');
INSERT INTO product (code, name) VALUES ('B004', 'AGMバッテリー12V');
INSERT INTO product (code, name) VALUES ('B005', 'セパレータロール');
INSERT INTO product (code, name) VALUES ('B006', '角形リチウムモジュール');
INSERT INTO product (code, name) VALUES ('B007', 'ジクロマット正極板');
INSERT INTO product (code, name) VALUES ('B008', 'コールドチェーン梱包材');
INSERT INTO product (code, name) VALUES ('B009', '48Vマイルド用補機バッテリー');
INSERT INTO product (code, name) VALUES ('B010', 'リサイクル鉛インゴット');
```

---

## API 仕様

### 1. GET /api/masters/parties — 取引先マスタ一覧

**用途**: ヘッダの契約先コード・納入先コードのプルダウン候補を返す。

**レスポンス**: `200 OK`

```json
[
  { "code": "1001", "name": "〇〇商事" },
  { "code": "2001", "name": "△△電池工業" },
  { "code": "3001", "name": "関東物流センター" }
]
```

**実装方針**:
- `PartyRepository.findAll()` で全件取得
- DTO は `{ code: String, name: String }` のシンプルな形
- ソート順はコード昇順

---

### 2. GET /api/masters/products — 製品マスタ一覧

**用途**: 明細グリッドの製品コード候補リストを返す。

**レスポンス**: `200 OK`

```json
[
  { "code": "B001", "name": "リチウムセルL型" },
  { "code": "B002", "name": "鉛蓄電池パック" }
]
```

**実装方針**:
- `ProductRepository.findAll()` で全件取得
- DTO は取引先と同じ `{ code: String, name: String }` 形式
- ソート順はコード昇順

---

### 3. POST /api/orders — 受注新規登録

**用途**: F12（保存）押下時にコールし、受注ヘッダ + 明細を DB に永続化する。

**リクエスト**: `Content-Type: application/json`

```json
{
  "contractPartyCode": "1001",
  "deliveryPartyCode": "3001",
  "deliveryLocation": "第2倉庫",
  "dueDate": "2026-04-06",
  "forecastNumber": "FC-2026-001",
  "lines": [
    {
      "productCode": "B001",
      "productName": "リチウムセルL型",
      "quantity": 100,
      "unitPrice": 1500,
      "amount": 150000
    },
    {
      "productCode": "B004",
      "productName": "AGMバッテリー12V",
      "quantity": 50,
      "unitPrice": 3200,
      "amount": 160000
    }
  ]
}
```

**レスポンス**: `201 Created`

```json
{
  "orderId": 1,
  "orderNumber": "ORD-20260330-001",
  "message": "受注を登録しました"
}
```

**実装方針**:
- `orderNumber` はサーバ側で自動採番する（例: `ORD-yyyyMMdd-連番` 形式）
- `createdAt` はサーバ側で現在日時を設定
- `amount` はリクエストに含まれるが、サーバ側でも `quantity × unitPrice` を検算するのが望ましい（Phase 1 では信頼してもよい）
- ヘッダと明細を1トランザクションで保存（`@Transactional`）
- 空行（`productCode` が空）はフロント側でフィルタ済みの前提。サーバ側でもバリデーションするのが望ましい

**エラーレスポンス**:
- `400 Bad Request` — バリデーションエラー（必須項目不足など）
- `401 Unauthorized` — トークンなし・期限切れ

---

## パッケージ構成（推奨）

```
com.example.demo/
├── api/
│   ├── auth/           ← 既存（AuthController）
│   ├── master/
│   │   └── MasterController.java     ← 取引先・製品マスタ API
│   └── order/
│       ├── OrderController.java       ← 受注登録 API
│       ├── OrderCreateRequest.java    ← リクエスト DTO
│       └── OrderCreateResponse.java   ← レスポンス DTO
├── domain/
│   ├── party/
│   │   ├── Party.java                 ← エンティティ
│   │   └── PartyRepository.java       ← Spring Data JPA
│   ├── product/
│   │   ├── Product.java
│   │   └── ProductRepository.java
│   └── order/
│       ├── OrderHeader.java
│       ├── OrderLine.java
│       ├── OrderHeaderRepository.java
│       └── OrderService.java          ← 採番・保存ロジック
└── config/
    └── SecurityConfig.java            ← 既存
```

---

## H2 Database 設定（`application.properties` または `application.yml`）

```properties
spring.datasource.url=jdbc:h2:mem:demodb
spring.datasource.driver-class-name=org.h2.Driver
spring.datasource.username=sa
spring.datasource.password=
spring.jpa.database-platform=org.hibernate.dialect.H2Dialect
spring.jpa.hibernate.ddl-auto=create-drop
spring.h2.console.enabled=true
spring.h2.console.path=/h2-console
spring.jpa.defer-datasource-initialization=true
spring.sql.init.mode=always
```

- `ddl-auto=create-drop` で起動時にスキーマを自動生成
- `spring.jpa.defer-datasource-initialization=true` + `spring.sql.init.mode=always` で `data.sql` の初期データ投入を JPA のスキーマ生成後に実行
- H2 Console（`/h2-console`）を有効化し、開発中のデータ確認に使う

---

## 完了条件

1. **`GET /api/masters/parties`** が取引先マスタ一覧を JSON 配列で返す
2. **`GET /api/masters/products`** が製品マスタ一覧を JSON 配列で返す
3. **`POST /api/orders`** がヘッダ + 明細を H2 に保存し、受注番号を含むレスポンスを返す
4. 上記すべてが **JWT 認証必須**（Bearer トークンなしで `401`）
5. H2 Console でデータが確認できる

---

## 手動チェックリスト

```bash
# 1. ヘルスチェック（認証不要）
curl -s http://localhost:8080/health

# 2. ログイン
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"demo","password":"password"}' | jq -r '.accessToken')

# 3. 取引先マスタ取得
curl -s http://localhost:8080/api/masters/parties \
  -H "Authorization: Bearer $TOKEN" | jq .

# 4. 製品マスタ取得
curl -s http://localhost:8080/api/masters/products \
  -H "Authorization: Bearer $TOKEN" | jq .

# 5. 受注登録
curl -s -X POST http://localhost:8080/api/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "contractPartyCode": "1001",
    "deliveryPartyCode": "3001",
    "deliveryLocation": "第2倉庫",
    "dueDate": "2026-04-06",
    "forecastNumber": "",
    "lines": [
      {"productCode":"B001","productName":"リチウムセルL型","quantity":10,"unitPrice":1500,"amount":15000}
    ]
  }' | jq .

# 6. 認証なしで 401 確認
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/masters/parties
# → 401
```
