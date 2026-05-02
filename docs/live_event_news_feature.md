# Live Events News Feature (F2)

## Overview
The Live Events Info feature (F2) integrates the Finnhub news API with Gemini AI to generate a personalized, cause-effect news rail for the dashboard. It aims to provide beginner-friendly, contextual investment insights by explaining *what happened*, *why it happened*, and *what it means for the user's portfolio*.

## Current Status & Progress

### 1. Data Fetching (Finnhub API) - `lib/finnhub.ts`
- [x] Integrate Finnhub API for general market news.
- [x] Integrate Finnhub API for specific company news based on user tickers.
- [x] Map raw Finnhub data to internal `NewsItem` type.

### 2. API Route & Caching - `app/api/news/route.ts`
- [x] Create `GET /api/news` endpoint.
- [x] Implement efficient in-memory caching (15-minute expiration) keyed by ticker hash to optimize API usage and reduce latency.
- [x] Fetch top 3 user holdings' news + market news.
- [x] Deduplicate news items by headline.
- [x] Sort by date and limit to top items (e.g., 5-7 items).

### 3. AI Enrichment (Gemini) - `lib/gemini.ts`
- [x] Implement `analyzeNewsItems` function.
- [x] Send batched news items to Gemini 2.5 Flash for analysis.
- [x] Extract `why` (one-line reason), `forYou` (portfolio impact), `deepDive` (1-2 paragraph context), and `importance` (high/normal).

### 4. UI Component - `components/NewsRail.tsx`
- [x] Build responsive `NewsRail` component.
- [x] Implement horizontal scrolling mechanics (mouse wheel interception).
- [x] Create news cards with header, source, and time.
- [x] Integrate Gemini-generated insights (`geminiWhy`, `geminiForYou`).
- [x] Implement accordion interaction for the `deepDive` expanded view.
- [x] Add visual highlights (accent line, glow) for "high" importance news.
- [x] Handle loading and error states gracefully.

### 5. Scheduled Refresh & DB Cache (Pending/Optional)
*Note: The PRD initially specified a Supabase `news_cache` table and a Vercel cron job (every 4h). However, the current approach utilizes an in-memory cache directly in the API route, which fulfills the "efficient in-memory caching" priority discussed previously.*
- [ ] Implement Vercel cron job for 4h background refresh (if transitioning from in-memory to DB).
- [ ] Set up `news_cache` table in Supabase (if transitioning from in-memory to DB).

## Next Steps
- Verify the integration of `<NewsRail />` in the main dashboard (`app/dashboard/page.tsx`).
- Test edge cases where Gemini might be unreachable (fallback to raw Finnhub summaries).
- Refine the Gemini prompt if the personalized insights need tuning.

---
*Document created to track conversation history and feature development state.*
