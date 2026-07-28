<div align="center">

  <img src="assets/icon.png" alt="QuickBill Logo" width="120" height="120" style="border-radius: 24px;" />

  # QuickBill 🧾

  **The Offline-First Mobile & Tablet Point of Sale (POS) & Billing System**

  [![Expo SDK](https://img.shields.io/badge/Expo-v57.0.0-000000.svg?style=for-the-badge&logo=expo)](https://docs.expo.dev/)
  [![React Native](https://img.shields.io/badge/React_Native-0.86.0-61DAFB.svg?style=for-the-badge&logo=react)](https://reactnative.dev/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6.svg?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
  [![SQLite](https://img.shields.io/badge/SQLite-Offline_First-003B57.svg?style=for-the-badge&logo=sqlite)](https://docs.expo.dev/versions/latest/sdk/sqlite/)
  [![License](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE)

  [📲 **Download APK**](https://expo.dev/accounts/ashrif_rihan/projects/QuickBill/builds/fa9dc009-3148-4aa6-b9fd-d87e1f53da77) • [📱 **Screenshots**](#-app-screenshots--user-flow) • [✨ Features](#-key-features) • [🛠️ Tech Stack](#%EF%B8%8F-tech-stack) • [🚀 Getting Started](#-getting-started) • [📖 Architecture](#-architecture--design-principles)

</div>

---

## 📲 Install on Android

### 📥 [**Download & install QuickBill v1.0.0**](https://expo.dev/accounts/ashrif_rihan/projects/QuickBill/builds/fa9dc009-3148-4aa6-b9fd-d87e1f53da77)

**Open that link on the Android phone itself** — then tap **Install**.

Android will warn about installing from an unknown source; allow it for your
browser and continue. Nothing else is needed — no account, no sign-up, no
internet. On first launch QuickBill asks you to create the shop's owner account,
and the till is ready.

| | |
| :--- | :--- |
| **Build** | `preview` · standalone APK · `arm64` Android |
| **Version** | 1.0.0 (`com.quickbill.pos`) |
| **Works offline** | Yes — completely |
| **Requires** | Android 7.0+ with a rear camera for scanning |

---

## 📱 App Screenshots & User Flow

Experience the intuitive cashier workflow from sign-in to checkout and settings:

<div align="center">

### 1. Authentication & Till Dashboard

| 🔑 Step 1: Sign In | 🏠 Step 2: Sales Dashboard | 📷 Step 3: Barcode Scanner |
| :---: | :---: | :---: |
| <img src="systemScreenshots/Login%20page.jpg" width="250" alt="Login Screen" style="border-radius: 12px;" /> | <img src="systemScreenshots/Home%20page.jpg" width="250" alt="Home Dashboard" style="border-radius: 12px;" /> | <img src="systemScreenshots/Scan%20page.jpg" width="250" alt="Scan Page" style="border-radius: 12px;" /> |
| *Offline salted login authentication & security features* | *Live daily revenue, active bill banner & low-stock metrics* | *Hardware-accelerated barcode reader with torch control* |

<br/>

### 2. Product Catalogue & Sales History

| 📦 Step 4: Product Catalogue | 🧾 Step 5: Bill History | 📄 Step 6: Invoice Details |
| :---: | :---: | :---: |
| <img src="systemScreenshots/Product%20page.jpg" width="250" alt="Product Catalogue" style="border-radius: 12px;" /> | <img src="systemScreenshots/Bill%20page.jpg" width="250" alt="Bill History" style="border-radius: 12px;" /> | <img src="systemScreenshots/Bill%20details%20page.jpg" width="250" alt="Bill Details" style="border-radius: 12px;" /> |
| *Stock management, pricing tiers & instant barcode lookup* | *Searchable bill registry with payment status indicators* | *Itemized invoice summary with PDF printing & sharing* |

<br/>

### 3. Profile & System Configuration

| ⚙️ Step 7: Profile & Shop Settings |
| :---: |
| <img src="systemScreenshots/Profile%20page.jpg" width="280" alt="Profile and Settings" style="border-radius: 12px;" /> |
| *Shop profile, tax configurations, dark mode toggle & Nexzoa developer credits* |

</div>

---

## 🔄 Building a new APK

```bash
npx eas build --profile preview --platform android
```

When it finishes, the terminal prints a fresh install URL and QR code. Swap that
URL into the heading above.

| Profile | Command | Use it for |
| :--- | :--- | :--- |
| `preview` | `npx eas build --profile preview --platform android` | A standalone APK to hand to a shop. **This is the one above.** |
| `development` | `npx eas build --profile development --platform android` | Development with hot reload against `npm start`. |

All builds for this project live at
[expo.dev → QuickBill builds](https://expo.dev/accounts/ashrif_rihan/projects/QuickBill/builds)
(requires signing in to the Expo account that owns the project).

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
├── systemScreenshots/       # System screenshots for user flow documentation
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
  <sub>Built with ❤️ for small businesses and retail cashiers by Nexzoa.</sub>
</div>
