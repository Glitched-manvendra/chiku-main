# Welcome to your Chiku project

## Project info

**URL**: REPLACE_WITH_PROJECT_URL

## How can I edit this code?

There are several ways of editing your application.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## System Design

### High-level architecture

- **Client (SPA shell)**
  - Vite + React app served at `/`.
  - The `/` route redirects users to the static CryptoTracker pages under `/crypto/index.html`.

- **Client (CryptoTracker static app)**
  - Static HTML/CSS/JS hosted in `public/crypto`.
  - Runs fully in the browser and talks directly to CoinGecko.

- **External dependency**
  - **CoinGecko REST API** (`https://api.coingecko.com/api/v3`) for market listings and coin details.

### Key modules

- **Routing / entrypoints**
  - `src/App.tsx`: React Router setup.
  - `src/pages/Index.tsx`: redirects to `/crypto/index.html`.

- **CryptoTracker pages**
  - `public/crypto/index.html`: landing page.
  - `public/crypto/markets.html` + `public/crypto/markets.js`: markets table (pagination, search, sorting, polling).
  - `public/crypto/coin.html` + `public/crypto/coin.js`: coin details (reads `?id=...`).

- **Shared client utilities**
  - `public/crypto/app.js`: API wrapper, request cancellation, formatting, DOM helpers, debounce, rate-limit handling, theme.

### Data flow

- **Markets page**
  - Browser loads `markets.html`.
  - `markets.js` calls `API.fetch('/coins/markets?...')` to retrieve pages of coins (INR pricing).
  - Results are rendered into a table; UI supports:
    - Sorting (rank/name/price/24h change/market cap)
    - Searching (client-side filter)
    - Pagination (“Load More”)
  - A polling loop refreshes all loaded pages periodically.

- **Coin details page**
  - Browser loads `coin.html?id=<coinId>`.
  - `coin.js` calls `API.fetch('/coins/<coinId>')`.
  - The description is sanitized to plain text before rendering.

### Reliability and performance

- **Request cancellation**
  - `API.fetch()` uses `AbortController` and cancels any in-flight request with the same key.

- **Rate limiting**
  - HTTP `429` is mapped to a `RateLimitError`.
  - Markets polling backs off (increasing interval) when rate-limited.

- **Rendering performance**
  - Markets updates attempt to update existing table rows instead of always rebuilding the full DOM.

### Security considerations

- **Untrusted content**
  - Coin descriptions from CoinGecko can contain HTML; the app strips HTML before rendering.

### Deployment model

- This is a **static frontend**.
- Build the Vite app and host the output along with `public/crypto`.
- Since the CryptoTracker pages call CoinGecko from the browser, ensure your hosting supports HTTPS to avoid mixed-content issues.

## How can I deploy this project?

Use your preferred hosting provider (for example Netlify, Vercel, or a VPS) and deploy the output of `npm run build`.
