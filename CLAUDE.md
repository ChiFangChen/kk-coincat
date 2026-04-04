# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

- `npm run dev` — Vite dev server with HMR
- `npm run build` — TypeScript compilation (`tsc -b`) + Vite production build
- `npm run lint` — ESLint
- `npm run preview` — Preview production build locally

No test framework is configured.

## Deployment

GitHub Actions deploys to GitHub Pages on push to `main`. The app is served at base path `/kk-coincat/`.

## Architecture

**Stack:** React 19 + TypeScript + Vite + Tailwind CSS + Firebase Firestore

**PWA:** Installable standalone app via vite-plugin-pwa + Workbox.

### State Management

Global state lives in `src/context/AppContext.tsx` using React Context + `useReducer`. The context provides all CRUD methods for users, trips, and expenses.

**Data flow:** UI action → context method → reducer → localStorage save → Firebase sync (if online) → Firebase listener updates local state.

### Routing

Custom state-based routing in `App.tsx` — does **not** use React Router despite it being a dependency. Navigation is driven by `selectedTripId`, `authPage`, and `showSwitchUser` state. The last selected trip persists to localStorage (`kk-coincat-route-trip`).

### Persistence

Dual-layer: localStorage as primary store, Firebase Firestore for real-time sync.

- `src/utils/storage.ts` — localStorage keys all prefixed `kk-coincat-*`
- `src/utils/firebase.ts` — Firestore collections: `ccUsers`, `ccTrips`, `ccTripExpenses`, `app/settings`

### Key Modules

- `src/types/index.ts` — All TypeScript interfaces (User, Trip, TripExpense, SplitDetail, etc.)
- `src/utils/settlement.ts` — Balance calculation and greedy transfer minimization algorithm
- `src/utils/currency.ts` — Exchange rate fetching (exchangerate-api.com) and conversion
- `src/utils/id.ts` — UUID generation via `crypto.randomUUID()`

### Component Structure

```
App → AppProvider → AppContent
  ├── Login / Register (auth)
  ├── SwitchUser
  ├── TripList (home)
  └── TripDetail
        ├── NavBar (bottom tabs: 帳務/結算/設定)
        ├── TripExpenses
        ├── TripSettlement
        └── TripSettings
```

### Styling

CSS variables in `App.css` with dark/light theme support (`.theme-dark` class). Tailwind for utilities. Mobile-first with safe-area-inset handling for notched devices.

### Auth & Admin

Simple username/password auth (no OAuth). First registered user becomes admin. Admins see all trips; regular users see only their own.

### UI Language

The UI is in Traditional Chinese (zh-TW). Code (variables, comments) is in English.
