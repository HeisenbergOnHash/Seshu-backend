# Backend Review + Frontend Sync Notes

This document captures backend updates already merged and the exact frontend changes needed to stay aligned.

- Backend base URL (local): `http://localhost:8080`
- API base path: `/api`
- Auth header for protected routes: `Authorization: Bearer <jwt>`

## Backend changes implemented

- **Auth endpoints confirmed**
  - `POST /api/auth/login`
  - `GET /api/auth/me`
- **Protected domain routes under `/api`**
  - borrowers, loans, transactions, wallet, dashboard reports
- **Ownership-aware access control is active**
  - AGENT is scoped to owned borrower/loan/transaction resources
  - ADMIN bypasses ownership checks
- **JWT hard requirement**
  - `JWT_SECRET` is required at startup (no insecure fallback secret)
- **Interest guard for empty rate logs**
  - Interest engine falls back safely if no `rateLogs` exist
- **Database layer**
  - PostgreSQL via Prisma datasource (`provider = "postgresql"`)

### Required backend env assumptions

```env
DATABASE_URL=postgresql://...
JWT_SECRET=your_strong_secret
PORT=8080
```

If `JWT_SECRET` is missing, backend startup fails by design.

## Frontend changes required now

### 1) Login + session

- Use `POST /api/auth/login` and store `token`.
- On app boot, call `GET /api/auth/me` to restore user and role.
- Send bearer token on all protected requests.
- On `401`, clear session and redirect to login.
- Keep `403` as access-denied UX (do not logout).

### 2) Borrower screens

- Borrower list: AGENT sees own borrowers only; ADMIN sees all.
- Borrower details: handle `403` (owned-by-other-agent) and `404` (not found).
- Borrower active/inactive toggle: send `{ "isActive": boolean }`.
- Borrower create form should not send `agentId`; backend assigns from token.

### 3) Loan screens

- Loan list: AGENT sees own loans (`createdById`), ADMIN sees all.
- Loan details support `?asOf=YYYY-MM-DD` for date-specific interest snapshots.
- Render interest-specific fields from detail response:
  - `interestInfo`
  - `termDays`
  - per-transaction `balanceAfterTx`
- Loan dates update route allows clearing due date with `null`.
- Foreclose action should confirm user intent and handle:
  - `400` when already closed/foreclosed
  - successful response containing `totalPayable`

### 4) Transaction screens

- Transaction create validates loan ownership.
- Transaction update validates transaction ownership (via parent loan).
- List endpoint supports optional `startDate` and `endDate`.
- Prevent accidental double-submit in UI for financial writes.

### 5) Dashboard + wallet

- Dashboard metrics are role-scoped (AGENT own data, ADMIN global).
- Wallet `balance` is dynamically computed server-side; use API values as source of truth.

### 6) Date UX and params

- Send form calendar dates as `YYYY-MM-DD` for:
  - loan create/update (`startDate`, `dueDate`)
  - rate updates (`effectiveDate`)
  - loan snapshot query (`asOf`)
- Backend date math is IST (`Asia/Kolkata`) calendar-day based.
- Transaction filters pass through `new Date(...)`; prefer ISO-safe date strings.

## API contracts by module

All error responses use:

```json
{ "error": "message" }
```

### Health

- **GET** `/health` (no auth)
  - Success: plain `"OK"`

### Auth (`/api/auth`)

- **POST** `/api/auth/login` (no auth)
  - Request:
    ```json
    { "phone": "9876543210", "password": "secret" }
    ```
  - Success:
    ```json
    {
      "token": "jwt",
      "user": { "id": "uuid", "name": "Name", "phone": "9876543210", "role": "AGENT" }
    }
    ```
  - Errors: `400` missing fields, `401` invalid credentials

- **GET** `/api/auth/me` (auth required)
  - Success:
    ```json
    { "id": "uuid", "name": "Name", "phone": "9876543210", "role": "ADMIN" }
    ```
  - Errors: `401` invalid/missing token, `404` user not found

### Borrowers (`/api/borrowers`) - auth required

- **GET** `/api/borrowers`
  - Success: borrower array with nested `loans`
  - Scope: AGENT filtered to `agentId === userId`, ADMIN all

- **POST** `/api/borrowers`
  - Request:
    ```json
    {
      "name": "Borrower",
      "phone": "9123456789",
      "altPhone": "optional",
      "address": "optional",
      "idNumber": "optional",
      "notes": "optional"
    }
    ```
  - Success: created borrower
  - Errors: typically `400` validation/constraint, `401`

- **GET** `/api/borrowers/:id`
  - Success: borrower with `loans`
  - Errors: `403` forbidden ownership, `404` borrower not found

- **POST** `/api/borrowers/:id/toggle-status`
  - Request:
    ```json
    { "isActive": true }
    ```
  - Success: updated borrower
  - Errors: `403`, `404`, `400` invalid update body

### Loans (`/api/loans`) - auth required

- **GET** `/api/loans`
  - Success: loan array with nested `borrower` and `transactions`
  - Scope: AGENT own, ADMIN all

- **POST** `/api/loans`
  - Request:
    ```json
    {
      "borrowerId": "uuid",
      "principal": 50000,
      "interestRate": 2,
      "interestRateType": "PERCENTAGE",
      "interestType": "DAILY",
      "startDate": "2026-01-15",
      "dueDate": "2026-04-15"
    }
    ```
  - Notes:
    - `interestRateType`: `PERCENTAGE | FIXED` (default `PERCENTAGE`)
    - `interestType`: `DAILY | WEEKLY | MONTHLY`
    - creates initial interest rate log at `startDate`

- **GET** `/api/loans/:id?asOf=YYYY-MM-DD`
  - Success: loan details + computed fields:
    - `interestInfo`
    - `termDays`
    - `transactions[].balanceAfterTx`
  - Errors: `403`, `404`

- **POST** `/api/loans/:id/dates`
  - Request:
    ```json
    { "startDate": "2026-01-20", "dueDate": "2026-05-20" }
    ```
  - Notes:
    - `dueDate: null` clears due date
    - if `startDate` changes, first rate-log `effectiveDate` is adjusted

- **POST** `/api/loans/:id/rate`
  - Request:
    ```json
    { "interestRate": 2.5, "interestRateType": "PERCENTAGE", "effectiveDate": "2026-02-01" }
    ```
  - Success: created rate-log entry (and loan’s current rate fields updated)

- **POST** `/api/loans/:id/foreclose`
  - Request:
    ```json
    { "notes": "optional" }
    ```
  - Success:
    ```json
    { "message": "Loan foreclosed successfully", "totalPayable": 12345.67 }
    ```
  - Backend behavior:
    - status set to `FORECLOSED`
    - foreclosure row inserted
    - auto settlement transactions added for outstanding interest/principal
  - Errors: `400` already closed/foreclosed, `403`, `404`

### Transactions (`/api/transactions`) - auth required

- **GET** `/api/transactions?startDate=...&endDate=...`
  - Success: transactions with nested `loan.borrower`
  - Scope: AGENT own-loan transactions, ADMIN all

- **POST** `/api/transactions`
  - Request:
    ```json
    {
      "loanId": "uuid",
      "type": "INTEREST_COLLECTION",
      "amount": 500,
      "paymentMethod": "CASH",
      "referenceNumber": "optional",
      "remarks": "optional",
      "date": "2026-02-10"
    }
    ```
  - `type`: `CREDIT | DEBIT | INTEREST_COLLECTION | CHARGE`
  - `paymentMethod`: `CASH | UPI | BANK_TRANSFER | CHEQUE | CARD | OTHER`
  - `date` optional, defaults to now

- **POST** `/api/transactions/:id`
  - Request (any subset):
    ```json
    { "type": "DEBIT", "amount": 1000, "date": "2026-02-11" }
    ```
  - Errors: `403`, `404`, `400`

### Wallet (`/api/wallet`) - auth required

- **GET** `/api/wallet`
  - Success shape:
    ```json
    {
      "id": "uuid",
      "userId": "uuid",
      "balance": 125000,
      "totalAssets": 480000,
      "totalCollections": 95000,
      "interestEarned": 32000,
      "totalLiabilities": 0,
      "updatedAt": "ISO"
    }
    ```
  - Notes:
    - `balance` returned is dynamic (computed), not raw stored value
  - Errors: `404` wallet not found, `500` unexpected runtime error

### Reports (`/api/reports`)

- **GET** `/api/reports/dashboard` (auth required)
  - Success:
    ```json
    {
      "totalLoans": 42,
      "activeLoans": 30,
      "totalPrincipal": 2500000,
      "totalCollections": 180000,
      "interestEarned": 65000
    }
    ```
  - Scope: AGENT own portfolio, ADMIN global

## Error handling + auth behavior

### Frontend error handling matrix

- **400 Bad Request**
  - Cause: malformed body, invalid date/number, business-rule violations
  - FE: show inline field errors or action-specific toast, keep user on current screen

- **401 Unauthorized**
  - Cause: missing bearer token, invalid/expired token
  - FE: clear session token, redirect to login, preserve intended return path if possible

- **403 Forbidden**
  - Cause: authenticated but fails ownership/role check
  - FE: show access-denied state; do not clear auth session

- **404 Not Found**
  - Cause: borrower/loan/transaction/user/wallet not found
  - FE: show not-found empty state or return to listing page

- **500 Internal Server Error**
  - Cause: unexpected server-side failure
  - FE: generic retryable error UI

### Token and startup notes

- Token signed with `JWT_SECRET`, expiry is `7d`
- Missing `JWT_SECRET` stops backend startup
- No insecure fallback secret should be assumed anywhere in FE

## Role and ownership behavior (UI gating)

- **ADMIN**
  - Full read/write across borrowers, loans, transactions, reports
- **AGENT**
  - Borrowers: only where `borrower.agentId === userId`
  - Loans: only where `loan.createdById === userId`
  - Transactions: only where `transaction.loan.createdById === userId`

### Recommended UI gating

- Hide/disable actions that can never succeed for AGENT across non-owned records.
- Still keep server-driven handling for direct URL access (show `403` UX).
- On list pages, expect backend scoping already applied by role.

## Date handling notes (IST/calendar behavior)

- Lending calendar math uses timezone `Asia/Kolkata`.
- Dates from forms should be sent as `YYYY-MM-DD` for consistency.
- `asOf` snapshots should use calendar date strings (not locale text).
- Transaction filter dates should be ISO-safe to avoid browser parse ambiguity.

## Recommended next backend enhancements (what else can we add)

1. Validation layer standardization
   - Add Joi/Zod DTO validation for all controller inputs
   - Return a stable validation error schema for FE mapping
2. OpenAPI/Swagger spec
   - Generate API docs and typed FE clients
3. Pagination + filtering
   - Add `page`, `limit`, `sort`, `search` to borrowers/loans/transactions lists
4. Audit trail
   - Log actor + action for rate updates, foreclosure, status toggles, edits
5. Refresh-token flow
   - Short-lived access token + refresh token rotation
6. Idempotency for financial writes
   - Idempotency keys for transaction/foreclosure endpoints
7. Webhooks or SSE
   - Optional real-time dashboard/wallet updates
8. Test coverage baseline
   - Integration tests for auth, ownership boundaries, and interest edge cases

## QA checklist for FE/BE integration

### Auth

- [ ] Login success returns token + user payload
- [ ] Invalid credentials return `401`
- [ ] Missing/invalid bearer token returns `401`
- [ ] `/api/auth/me` restores role and user profile
- [ ] Backend startup fails without `JWT_SECRET`

### Ownership boundaries

- [ ] AGENT cannot access another AGENT's borrower details (`403`)
- [ ] AGENT cannot update another AGENT's loan/transactions (`403`)
- [ ] ADMIN can perform same operations successfully

### Lending and transactions

- [ ] Loan detail returns `interestInfo`, `termDays`, and `balanceAfterTx`
- [ ] `asOf` date changes interest snapshot predictably
- [ ] Foreclose creates settlement records and blocks repeated closure
- [ ] Empty/missing rate-log scenarios do not crash calculations

### Wallet and dashboard

- [ ] Wallet computed numbers match expected portfolio state
- [ ] Dashboard values are role-scoped correctly

### Dates

- [ ] `YYYY-MM-DD` inputs map correctly to IST day boundaries
- [ ] Transaction date filters include expected records across timezone boundaries
