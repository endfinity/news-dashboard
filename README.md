# News Dashboard

A modern US news headlines dashboard built with vanilla JavaScript on the frontend and an Express proxy backend using the [NewsAPI](https://newsapi.org/).

## Features

- **Top Headlines**: Browse top headlines across various categories (General, Business, Technology, Health, Science, Sports, Entertainment).
- **Search**: Search for specific news articles within categories.
- **Save Articles**: Bookmark interesting articles to read later (saved to local storage).
- **Filtering**: Filter articles by source, US major outlets, and time (All time, 24h, 7d).
- **Responsive UI**: Fully responsive sidebar layout designed for mobile and desktop viewing.
- **Backend Proxy**: Express server to securely make requests to NewsAPI without exposing your API key to the client.
- **Caching & Rate Limiting**: The backend includes robust caching (memory cache) to minimize external API requests, and an IP-based rate limiter to prevent abuse.
- **Metrics**: A `/metrics` endpoint to monitor cache hits, misses, rate limits, and uptime.

## Architecture

This application consists of two main parts:
1. **Frontend (`public/`)**: A Single Page Application (SPA) built with purely vanilla HTML, CSS, and JavaScript. It uses `fetch` to communicate with the backend.
2. **Backend (`src/`)**: A Node.js Express server acting as a proxy. It receives requests from the frontend, securely applies the `NEWSAPI_KEY`, manages API rate limiting per IP, caches responses to improve performance, and forwards the results back to the frontend.

## Installation

### Prerequisites
- Node.js (v16+ recommended)
- A NewsAPI Key (get one for free at [newsapi.org](https://newsapi.org/))

### Steps
1. Clone the repository and navigate into the folder:
   ```bash
   git clone <repository-url>
   cd news-dashboard
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure Environment Variables:
   Copy `.env.example` to `.env` and fill in your details:
   ```bash
   cp .env.example .env
   ```
   Open `.env` and add your `NEWSAPI_KEY`.

4. Start the development server:
   ```bash
   npm run dev
   ```
   The application will be accessible at `http://localhost:3000`.

## Environment Variables

| Variable | Description | Default |
| --- | --- | --- |
| `NEWSAPI_KEY` | Your secret API key from NewsAPI.org | `[Required]` |
| `PORT` | Port for the Express server | `3000` |
| `NEWS_CACHE_TTL_MS` | Cache Time-To-Live in milliseconds | `60000` (1 min) |
| `NEWS_RATE_LIMIT_PER_WINDOW` | Maximum allowed API requests per IP per window | `60` |

## Available Scripts

- `npm start`: Starts the production Node.js server.
- `npm run dev`: Starts the server with `nodemon` for auto-reloading during development.

## Recent Improvements

- **CSS Fixes**: Restored the rendering of category badges in the frontend.
- **UI State Enhancements**: Improved the UI logic to appropriately clear skeleton loaders if a news fetch request fails.
- **Memory Leak Resolution**: Added periodic cleanup of the `headlinesCache` to prevent memory bloat over time.
- **Proper 404 Handling**: Unrecognized `/api/*` endpoints now return standard JSON 404 responses instead of a fallback HTML file.
- **IP-Based Rate Limiting**: Changed rate limiting from a vulnerable global counter to an IP-address-based limiter, preventing single-user abuse from exhausting the quota for everyone.
