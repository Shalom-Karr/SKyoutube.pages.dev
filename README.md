# SK YouTube & Music Dashboard

A secure, serverless client designed to safely proxy YouTube requests and stream whitelisted music without exposing users to the broader, unfiltered platform.

## 🎯 The Philosophy

The modern YouTube interface is engineered for endless distraction and algorithmic rabbit holes. This project strips away the bloat, the recommended sidebar, the infinite scrolls, and the comments section. 

By integrating directly with **Techloq** (and other kosher filtering software logic), it provides a clean, 100% focused video and music dashboard. If a user is on a filtered network, links to generic YouTube are natively intercepted and redirected to this pristine viewing sandbox.

## 🏗️ Architecture & Serverless Stack

This project was built to cost **$0/month** while handling massive scale, utilizing a "Linux from Scratch" approach to web apps:
*   **Frontend:** Pure HTML5, Vanilla JS (`script.js`), and custom CSS. No bloated React payload.
*   **Backend / Proxy:** Cloudflare Pages Functions (`/api/youtubeproxy.js`) secure the YouTube API key from the client while proxying video and metadata requests seamlessly.
*   **Database:** Supabase handles the dynamic whitelists (e.g., approved `artists.sql` for the music app).
*   **Sub-Applications:** Includes a dedicated `/music` Progressive Web App (PWA) optimized for mobile streaming.

## 🚀 Setup & Local Development

### 1. The Proxy Function
The core magic happens via the Cloudflare Worker API. To run this locally, you must use Wrangler.
```bash
npm install -g wrangler
wrangler pages dev .
```

### 2. Environment Configuration
Your Cloudflare Pages project must have the following environment variables injected during the build step:
*   `YOUTUBE_API_KEY`: A valid Google Cloud YouTube Data v3 API Key.

### 3. Redirection System
When deployed to Cloudflare Pages, the `_routes.json` file ensures that all API requests hit the proxy function correctly, while `_redirects` handles SPA pathing for `/video` links, allowing users to share clean video URLs.

> *Built entirely with raw web primitives and AI-driven architecture to prioritize focus over engagement.*
