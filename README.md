<div align="center">

  <img src="assets/icon.png" alt="QuickBill Logo" width="120" height="120" style="border-radius: 24px;" />

  # QuickBill 🧾

  **The Offline-First Mobile & Tablet Point of Sale (POS) & Billing System**

  [![Expo SDK](https://img.shields.io/badge/Expo-v57.0.0-000000.svg?style=for-the-badge&logo=expo)](https://docs.expo.dev/)
  [![React Native](https://img.shields.io/badge/React_Native-0.86.0-61DAFB.svg?style=for-the-badge&logo=react)](https://reactnative.dev/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6.svg?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
  [![SQLite](https://img.shields.io/badge/SQLite-Offline_First-003B57.svg?style=for-the-badge&logo=sqlite)](https://docs.expo.dev/versions/latest/sdk/sqlite/)
  [![License](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE)

  [📲 Install on Android](#-install-on-android) • [✨ Features](#-key-features) • [🛠️ Tech Stack](#%EF%B8%8F-tech-stack) • [🚀 Getting Started](#-getting-started) • [📖 Architecture](#-architecture--design-principles)

</div>

---

## 📲 Install on Android

> **No prebuilt APK is published yet.** There are no GitHub Releases on this repo,
> so you need to produce a build once. It takes one command and about 10–20 minutes
> on Expo's free tier.

### Step 1 — Build the APK

```bash
npx eas build --profile preview --platform android
```

The first run asks two questions: it creates the EAS project, and offers to
generate an Android keystore — answer **yes** to both. When the build finishes,
the terminal prints a download URL and a QR code.

### Step 2 — Install it on your phone

Open that URL on the phone (or scan the QR code) and tap the APK. Android will
warn about installing from an unknown source — allow it for your browser, then
install. Nothing else is needed: the app works with no account and no internet.

You can also find every build at
**[expo.dev → your builds](https://expo.dev/accounts/ashrif_rihan/projects/QuickBill/builds)**
once the first one has run.

### Which profile do I want?

| Profile | Command | Use it for |
| :--- | :--- | :--- |
| `preview` | `npx eas build --profile preview --platform android` | A normal standalone APK to hand to a shop. **Start here.** |
| `development` | `npx eas build --profile development --platform android` | Day-to-day development with hot reload against `npm start`. |

### Publishing the APK as a download link

To turn a build into the permanent link this section used to claim, download the
APK from Expo and attach it to a GitHub Release:

```bash
gh release create v1.0.0 ./QuickBill.apk --title "QuickBill v1.0.0" --notes "First release"
```

After that, `https://github.com/ashrifrihan/QuickBill-/releases/latest/download/QuickBill.apk`
becomes a real link.

### ⚠️ Expo Go is not enough

Barcode scanning uses `expo-camera`, which is **not** available in Expo Go. Products,
cart, checkout, bills, PDF receipts and reports all work in Expo Go — scanning does
not. Use one of the builds above for the full app.

---

## ✨ Key Features

### 📱 1. Mobile & Tablet Adaptive UI
- **Dual Layout Engine**: Automatically transitions between single-column mobile view and a 2-pane split-screen counter view on tablets.
- **Bento Box & Soft Pastel Styling**: Aesthetic dashboard cards, rounded touch targets (min 44pt touch boundary), and smooth dark mode toggling.

### ⚡ 2. 100% Offline-First Architecture
- **Local SQLite Engine (`expo-sqlite`)**: All product catalogues, invoices, settings, and cashier accounts are persisted directly on the device.
- **Zero Cloud Reliance**: Perform complete sales, calculate change, view daily reports, and print receipts without any cellular or Wi-Fi connection.

### 🏷️ 3. High-Speed Barcode Scanning
- **Camera Scanner**: Integrated hardware-accelerated camera scanner (`expo-camera`) with haptic feedback, flashlight toggle, and manual input fallbacks.
- **Instant Product Routing**: Scanning an unregistered barcode automatically opens the "Add Product" screen with the barcode pre-filled.
- **Multi-Format Support**: Reads EAN-13, EAN-8, UPC-A/E, Code 39/93/128, ITF-14, Codabar, and QR codes.

### 🛒 4. Smart Checkout & Cart Engine
- **Line & Cart Discounts**: Support flat rate or percentage discounts with largest-remainder distribution (exact cent rounding guarantees).
- **Flexible Payment Types**: Cash (with instant change calculation), Card, Mobile Pay, and Unpaid (Store Credit / Partial Payments).
- **Cart Draft Recovery**: In-progress sales automatically save to draft, ensuring zero data loss if closed or interrupted.

### 📄 5. Receipt Printing & PDF Sharing
- **Thermal & PDF Receipt Engine**: Renders clean, formatted receipts for 58mm / 80mm thermal printers or PDF standard page formats.
- **Instant Digital Sharing**: Export receipts directly via WhatsApp, Email, or device Share Sheet (`expo-sharing`).

### 📊 6. Analytics & Stock Management
- **Inventory Tracking**: Stock levels, low-stock warnings, cost/margin analysis (Admin view), and inventory restocking alerts.
- **Sales Analytics**: Real-time daily, weekly, and monthly totals, average transaction values, and top-selling product metrics.

### 🔐 7. Security & Role Control
- **Role-Based Accounts**: Multi-user support with **Admin** and **Cashier** roles.
- **Key-Stretched Password Hashing**: Salted, iterated password hashing (`expo-crypto`) keeps credentials safe locally.

---

## 🛠️ Tech Stack

- **Core Framework**: [React Native 0.86](https://reactnative.dev/) & [Expo SDK 57](https://docs.expo.dev/)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Local Database**: `expo-sqlite` (Native SQLite with schema migrations)
- **Navigation**: `@react-navigation/native` (Native Stack & Floating Bottom Tabs)
- **Icons & Styling**: `@expo/vector-icons` (Ionicons), Vanilla CSS/StyleSheets with dynamic HSL dark mode theme system
- **Form Validation**: `react-hook-form` + `zod`
- **Testing**: `jest` + `@testing-library/react-native`

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- Expo Go app on your phone (for quick testing) or Android Studio / Emulator

### Quick Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/ashrifrihan/QuickBill-.git
   cd QuickBill
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm start
   ```

4. **Run on target environment**:
   - Press `a` in the terminal for Android Emulator
   - Scan the terminal QR code with Expo Go or Development Client

5. **Typecheck & Test**:
   ```bash
   npm run check
   ```

---

## 📖 Architecture & Design Principles

```
d:\QuickBill\
├── assets/                  # App icons, splash graphics & logos
├── src/
│   ├── App.tsx              # App startup: DB migrations → settings/auth initialisation
│   ├── config/              # Constants and theme palette tokens (Light/Dark HSL)
│   ├── data/                # SQLite connection, schema migrations & repository pattern
│   ├── domain/              # Pure domain models (Cart, Invoice, Product, Money, User)
│   ├── errors/              # AppError taxonomy, crash logger & ErrorBoundary
│   ├── navigation/          # React Navigation stacks, custom floating tab bar & guards
│   ├── services/            # BillingService, PrinterService, AuthService, ReportService
│   ├── store/               # Zustand stores (cartStore, authStore, settingsStore)
│   ├── ui/                  # UI components, responsive hooks, screens & modal sheets
│   └── utils/               # Money formatting, SHA-256 hashing, date helpers
└── index.ts                 # Expo entry point
```

### Financial Precision (Zero Float Errors)
All financial figures are stored as 64-bit integer cents. `Money.ts` ensures floating-point arithmetic glitches (`0.1 + 0.2 !== 0.3`) never occur on your till.

---

## 💻 Available Commands

| Command | Action |
| :--- | :--- |
| `npm start` | Launches Metro bundler & Expo dev server |
| `npm run android` | Starts app on connected Android device/emulator |
| `npm run typecheck` | Runs TypeScript compiler validation without emitting files |
| `npm test` | Runs complete Jest unit test suite |
| `npm run test:domain` | Runs fast domain logic tests |
| `npm run check` | Runs full typecheck + test suite |

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

<div align="center">
  <sub>Built with ❤️ for small businesses and retail cashiers.</sub>
</div>
