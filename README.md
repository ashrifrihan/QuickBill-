# QuickBill 🧾

**QuickBill** is a modern, offline-first Point of Sale (POS) and billing application built with React Native and Expo SDK 57. Designed for retail stores and small businesses, QuickBill provides fast barcode scanning, streamlined cart checkout, local SQLite persistence, thermal & PDF receipt printing, and comprehensive sales analytics.

---

## ✨ Features

- 📱 **Mobile & Tablet Ready**: Responsive layout designed for phones and multi-pane tablet counters.
- ⚡ **Offline-First Storage**: Native SQLite database (`expo-sqlite`) for full data privacy and zero cloud dependency.
- 🏷️ **High-Speed Barcode Scanner**: Built-in camera scanner (`expo-camera`) with scan debouncing supporting major barcode formats (EAN-13, EAN-8, UPC, Code 128, QR, etc.).
- 🛒 **Cart & Billing Engine**:
  - Item lookup via barcode scanning or text search.
  - Per-item and global cart discounts (percentage or flat amount).
  - Multi-payment support (Cash, Card, Online Transfer, Credit).
  - Cart draft recovery ensuring transaction state is preserved across app restarts.
- 📄 **Receipt Printing & Export**: Customizable HTML/CSS receipt template engine (`expo-print`) with PDF rendering and native file sharing (`expo-sharing`).
- 📦 **Inventory Management**: Product catalog with image support, category tags, stock tracking, and low-stock alerts.
- 📊 **Sales Reports & Analytics**: Daily and custom date-range sales summaries, revenue metrics, top-selling items, and payment breakdowns.
- 🔐 **Role-Based Authentication**: Secure local login with password hashing, supporting **Admin** and **Cashier** user roles.
- ⚙️ **Configurable Settings**: Custom shop header info, tax rates, currency defaults, invoice prefixes/numbering sequences, and dark/light UI themes.

---

## 🛠️ Tech Stack

- **Framework**: [React Native 0.86](https://reactnative.dev/) & [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/)
- **Language**: TypeScript
- **Database**: `expo-sqlite` (Native SQLite with schema migrations)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Navigation**: React Navigation (Bottom Tabs & Native Stack)
- **Hardware / Device APIs**: `expo-camera`, `expo-print`, `expo-sharing`, `expo-haptics`, `expo-image-picker`
- **Form Handling**: React Hook Form + Zod validation
- **Testing**: Jest & `@testing-library/react-native`

---

## 📁 Directory Structure

```
QuickBill/
├── assets/                  # Application icons, images, and splash graphics
├── src/
│   ├── config/              # Constants, app defaults, and theme definitions
│   ├── data/                # Database initialization, migrations, mappers, & SQLite repositories
│   ├── domain/              # Core domain models (Cart, Product, Invoice, Money, User)
│   ├── errors/              # AppError taxonomy, logger, and crash boundary handlers
│   ├── navigation/          # React Navigation setup and route parameter types
│   ├── services/            # Core business logic (BillingService, ProductService, PrinterService, etc.)
│   ├── store/               # Zustand global state stores (cartStore, authStore, settingsStore)
│   ├── ui/                  # UI presentation layer
│   │   ├── components/      # Reusable UI primitives, buttons, inputs, modals
│   │   └── screens/         # Screens (Dashboard, Cart, Scan, Products, Bills, Reports, Auth)
│   └── utils/               # Utility functions (currency formatting, hashing, date math)
├── App.tsx                  # App startup component & global providers
└── index.ts                 # Main Expo entry point
```

---

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed:

- **Node.js**: v18.0.0 or later
- **npm** (or yarn/pnpm)
- **Expo Go** application installed on your Android/iOS mobile device or a configured emulator/simulator.

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/QuickBill.git
   cd QuickBill
   ```

2. **Install project dependencies**:
   ```bash
   npm install
   ```

3. **Start the Expo development server**:
   ```bash
   npm start
   ```

---

## 📲 Development & Testing Commands

| Command | Description |
| :--- | :--- |
| `npm start` | Start the Expo CLI development server |
| `npm run android` | Launch Expo server targetting Android |
| `npm run ios` | Launch Expo server targetting iOS |
| `npm run web` | Launch Expo server targetting Web |
| `npm run typecheck` | Execute TypeScript type checking without emitting files |
| `npm test` | Run the full Jest test suite |
| `npm run test:domain` | Run unit tests specifically for domain models |
| `npm run check` | Run type checking and domain tests |

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
