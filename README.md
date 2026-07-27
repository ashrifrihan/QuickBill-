# QuickBill 🧾

**QuickBill** is an offline-first Point of Sale (POS) and billing app built with React Native and Expo SDK 57. Designed for small retail shops: fast barcode scanning, cart checkout, local SQLite persistence, PDF receipts, and sales reporting.

Built to the architecture in `QuickBill-Build-Guide.md`. **Phase 0 (foundation) and Phase 1 (the core MVP loop) are complete.** Phase 2/3 items are scaffolded but unfinished — see [What's not built yet](#-whats-not-built-yet).

The core loop works entirely offline:

> scan barcode → find product → set quantity → build cart → total up → save bill → print → history

---

## ✨ Features

- 📱 **Mobile & Tablet Ready**: Responsive layout; the cart screen rearranges into a two-pane counter layout on tablets rather than just stretching.
- ⚡ **Offline-First Storage**: Native SQLite (`expo-sqlite`) with versioned migrations. No cloud dependency, no network required for any part of a sale.
- 🏷️ **Barcode Scanner**: `expo-camera` with scan debouncing (one physical scan = one item) and haptic confirmation. Supports EAN-13, EAN-8, UPC-A/E, Code 39/93/128, ITF-14, Codabar, QR.
- 🛒 **Cart & Billing Engine**:
  - Lookup by barcode scan or text search.
  - Cart-level discount (percentage or flat amount), distributed exactly across lines.
  - Per-line price override for haggling or damaged goods.
  - Payment methods: Cash, Card, Mobile, Other — plus unpaid (credit) and partial payment.
  - Cart draft auto-saves, so a crash mid-sale loses nothing.
- 📄 **Receipt Printing & Export**: HTML/CSS receipt template rendered to PDF (`expo-print`) and shared via the native share sheet (`expo-sharing`).
- 📦 **Inventory Management**: Product catalogue with images, categories, stock tracking and low-stock alerts. Unknown barcodes route straight to "Add Product" with the code pre-filled.
- 📊 **Sales Reports**: Today / 7-day / month-to-date summaries, daily sales chart, and top products — all computed with SQL aggregates, not by loading rows into JS.
- 🔐 **Role-Based Authentication**: Local login with salted, key-stretched password hashing. **Admin** and **Cashier** roles, with admin-only screens guarded.
- ⚙️ **Configurable Settings**: Shop header, tax rate, currency, invoice prefix/numbering, low-stock threshold, and dark/light theme.

---

## 🛠️ Tech Stack

- **Framework**: [React Native 0.86](https://reactnative.dev/) & [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/)
- **Language**: TypeScript (strict)
- **Database**: `expo-sqlite` (native SQLite with schema migrations)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Navigation**: React Navigation (Bottom Tabs & Native Stack)
- **Device APIs**: `expo-camera`, `expo-print`, `expo-sharing`, `expo-haptics`, `expo-image-picker`, `expo-crypto`
- **Forms**: React Hook Form + Zod
- **Testing**: Jest (+ `@testing-library/react-native` for future component tests)

---

## 🚀 Getting Started

```bash
npm install
npm start
```

Then press `a` for Android, or scan the QR code with Expo Go.

### ⚠️ Camera scanning needs a development build

`expo-camera` does **not** run inside Expo Go. To test real barcode scanning:

```bash
npx eas build --profile development --platform android
```

Everything else — products, cart, totals, checkout, PDF bills, history, reports — runs fine in Expo Go.

### Verify before running

```bash
npm run check
```

---

## 📁 Directory Structure

Dependencies point **inward**: UI → services → repositories → models. Models depend on nothing.

```
QuickBill/
├── assets/                  # Icons, splash graphics
├── src/
│   ├── App.tsx              # Startup: error handlers → database → settings/auth/cart draft
│   ├── config/              # Constants and theme tokens
│   ├── data/                # Connection, migrations, mappers, repositories (behind interfaces)
│   ├── domain/              # Cart, Product, Invoice, Money, User — pure logic, no React, no SQL
│   ├── errors/              # Typed error taxonomy, logger, global handlers
│   ├── navigation/          # Navigators, route param types, role guards
│   ├── services/            # BillingService, PrinterService, AuthService, ReportService, …
│   ├── store/               # Zustand: cartStore, authStore, settingsStore
│   ├── ui/
│   │   ├── components/      # Shared themed primitives + ErrorBoundary
│   │   ├── hooks/           # The bridge from services to screens
│   │   └── screens/         # Dashboard, Scan, Cart, Checkout, Receipt, Products, Bills, More
│   └── utils/               # Formatting, date ranges, password hashing
└── index.ts                 # Expo entry point
```

---

## 🧠 The three decisions that matter most

**1. Money is integers, never floats.** Every amount is a whole number of cents (`src/domain/Money.ts`). `0.1 + 0.2 !== 0.3` becomes a real cash discrepancy on a till. Cart discounts are spread across lines using largest-remainder distribution so the parts always sum back to the whole — property-tested over 500 random splits.

**2. `Cart` owns all arithmetic.** Screens, the PDF and the thermal text all read `Cart.totals()`; none of them adds anything up itself. That is what makes it impossible for the printed total to disagree with the screen. Order of operations is fixed and documented: discount first, then per-line tax on the discounted share.

**3. Checkout is one transaction.** `BillingService.checkout()` allocates the invoice number, writes the header, writes every line and decrements stock inside a single `withExclusiveTransactionAsync`. Any failure rolls the whole thing back. Allocating the sequence *inside* that transaction is what makes duplicate invoice numbers impossible.

### Swapping the database later

Repositories are defined as interfaces (`src/data/repositories/interfaces.ts`) and wired in one place (`src/data/index.ts`). A `SupabaseProductRepository` implementing `IProductRepository` is a change to that single file — no screen or service is touched.

---

## 🛡️ Error handling

Typed errors (`ValidationError`, `NotFoundError`, `DatabaseError`, `PrinterError`, `PermissionError`, `AuthError`) each carry a **user-facing** message and a **technical** one. The UI shows the first; the logger records the second.

- Repositories wrap every SQLite call and rethrow as `DatabaseError`.
- `ErrorBoundary` wraps the app **and** each screen — one broken screen can't take down the till.
- Global handlers catch uncaught exceptions and unhandled promise rejections.
- Every data screen has three visible states: loading, loaded, empty-or-error.
- The in-progress cart auto-saves and is restored on relaunch.

To add crash reporting before release, call `setReporter()` in `src/errors/logger.ts`. Nothing else changes.

---

## 📲 Commands

| Command | Description |
| :--- | :--- |
| `npm start` | Start the Expo development server |
| `npm run android` / `ios` / `web` | Target a specific platform |
| `npm run typecheck` | TypeScript check, no emit |
| `npm test` | Full Jest suite |
| `npm run test:domain` | Fast pure-logic tests only |
| `npm run check` | Typecheck + domain tests |

---

## 🧪 Tests

76 tests, all pure logic and fast. They cover the things that cost real money if wrong: money parsing and rounding, discount distribution, tax ordering, cart totals, invoice immutability and balance, invoice number formatting, and that the receipt prints the *stored* total rather than one it recomputed.

Jest runs two projects — `domain` (plain Node + ts-jest, milliseconds) and `native` (jest-expo, for future component tests, file suffix `*.native.test.tsx`).

### Manual device checklist

Before a real shop uses it: scan in poor light, scan a damaged barcode, scan an unknown barcode (should route to Add Product pre-filled), edit quantities, complete a full sale with **WiFi off**, share a PDF, rotate on phone and tablet, and deny camera permission (should show a friendly screen with a settings link, never a crash).

---

## 🚧 What's not built yet

An honest list. These are Phase 2/3 in the guide and are deliberately unfinished:

- **Bluetooth thermal printing.** The strategy class and the 58mm/80mm receipt formatting are done; the ESC/POS transport is not. `BluetoothPrintStrategy.isAvailable()` returns `false`, so `PrinterService` transparently falls back to PDF and the cashier is never stranded. Wiring in a native ESC/POS module is the remaining work.
- **Cloud sync / Supabase.** The repository interfaces exist to make this a drop-in, but no sync code is written.
- **Multi-user management UI.** The `users` table, roles and route guards all work; there is no screen yet to add a second cashier.
- **Refunds.** `markAsRefunded()` exists on the service; no UI calls it.
- **Payment-method breakdown in reports.** Sales totals, daily trend and top products are implemented; a split by payment method is not.

### A note on password hashing

Local passwords use salted, iterated SHA-256 via `expo-crypto` (`src/utils/hash.ts`) — not bcrypt or argon2, which need a native module Expo doesn't expose. For an on-device till whose database never leaves the device this is a reasonable trade-off, and it's documented in the file. If accounts ever sync to a server, move authentication to Supabase Auth behind the existing `IAuthProvider` interface rather than sending this hash over the wire.

---

## 📄 License

MIT — see [LICENSE](LICENSE).
