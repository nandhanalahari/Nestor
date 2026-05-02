# Nestor — PRD (feature/waz)

**Hackathon:** "Empowering the Everyday Investor" (Goldman Sachs / UT Dallas Naveen Jindal School of Management)
**Branch:** `feature/waz` (off `main` @ `820d231`)
**Team:** 4
**Status:** Draft v1 — subject to scope cuts on day 3

---

## 1. Context

Nestor's `main` branch already ships a working portfolio platform (Next.js 16 + Supabase + Python ML): live quotes, holdings CRUD, 4 hardcoded what-if scenarios driven by XGBoost + MVO, an LSTM forecast, and a basic goals page. The product reads as a "lite Bloomberg" — the math works, but the experience still asks a beginner to know what to look at.

This PRD adds the layer that turns Nestor from a tool *for* beginners into a tool *that teaches* beginners. Every change here maps directly to one of the four judging criteria (UX 30 / Innovation 30 / Transparency 20 / Tech 20). We are not changing the ML pipeline. We are wrapping it with onboarding, explanation, gamification, and personal context so that a 24-year-old with $5k saved can use it on their phone and feel in control.

## 2. Personas

**Maya (primary) — "First Paycheck"**
24, junior at a consultancy, $5k in savings, $400/month available to invest, no brokerage account before this. Has heard "index funds" but doesn't know the difference between a stock and a fund. Anxious about losing money. Goal: house deposit in 6–7 years.

**Ravi (secondary) — "Inherited a Portfolio"**
35, has a spread of stocks an advisor set up years ago. Doesn't trust the advisor blindly anymore but doesn't know where to start. Needs explanations more than recommendations.

Both personas are jargon-averse. Both want to know *why*, not just *what*.

## 3. Feature scope (8 features)

| # | Feature | Owner area | Priority |
|---|---|---|---|
| F1 | Onboarding risk quiz | Frontend + DB | P0 |
| F2 | Cause-effect news rail | Backend + ML/AI | P0 |
| F3 | Portfolio health score | Frontend + math | P0 |
| F4 | Gamified historical lessons | Full stack | P0 (demo centerpiece) |
| F5 | Tax preview (simplified US) | Backend + math | P1 |
| F6 | Goal-linked progress projection | Backend + math | P1 |
| F7 | Natural-language scenario builder | Backend + AI | P1 |
| F8 | Click-to-learn jargon (Gemini) | Shared component | P1 |

Cut order if behind on day 4: F7 → F5 → reduce F4 from 3 lessons to 2.

---

## 4. Feature specs

### F1. Onboarding risk quiz

**User story.** As a new signup, I answer 5 plain-English questions and Nestor builds my investor profile before I see any portfolio screen.

**Flow.** `/auth` signup → `/onboarding` (5 cards, 1 question each) → result reveal → `/dashboard`.

**Questions (no jargon, scenario-framed).**
1. Time horizon: "When do you think you'll need most of this money?" (< 2y / 2–5y / 5–10y / 10y+)
2. Loss tolerance: "Your investments drop 25% in a month. You feel…" (sell most / sell some / hold / buy more)
3. Liquidity: "If something unexpected came up, how much should you be able to pull out within a week without hurting your plan?" ($1k / $5k / $20k / I don't know)
4. Goal feel: "Pick the closest reason you're investing." (house / education / retirement / general growth / other)
5. Experience self-rating: "How do you feel about investing today?" (nervous / curious / comfortable / confident)

**Output.** `risk_score` 0–100, `profile_label` ∈ {Steady Builder, Balanced Climber, Bold Grower}, `horizon_years`, `liquidity_window_months`, `primary_goal_kind`. Drives default scenario picks, F3 thresholds, and F6 expected return assumption.

**Acceptance criteria.**
- Quiz is non-skippable on first signup; can be re-taken later from `/profile`.
- Result reveal page shows profile name + 2-line plain-English summary + risk dial.
- All 5 answers stored in `user_profiles` table; `risk_score` derived deterministically from a small weighted formula in `lib/profile.ts`.
- Existing users (no profile yet) get a one-time banner offering to take the quiz.

**Data.**
- New table `user_profiles` (`user_id` PK FK, `risk_score` int, `horizon_years` int, `liquidity_window_months` int, `profile_label` text, `primary_goal_kind` text, `created_at`, `updated_at`).
- New endpoint `POST /api/profile` (upsert), `GET /api/profile`.

**MVP cut.** 5 questions, 3 outcomes, no re-take flow.

---

### F2. Cause-effect news rail

**User story.** On my dashboard I see 3–5 news cards. Each card explains *what happened*, *why it happened*, and *what it means for my portfolio*.

**Card content.**
- Headline + source + relative time
- One-line "Why this happened" (Gemini)
- One-line "What it means for **your** holdings: AAPL, NVDA" (Gemini, ticker-aware)
- Tap → expanded view with 1-paragraph deeper explanation and a link to the full source

**Acceptance criteria.**
- Rail is the second-most-prominent element on the dashboard (under the health score).
- Cards refresh every 4h via a scheduled job, **not** on every page load.
- "What it means for you" must reference the user's actual holdings or be omitted.
- If Gemini is unreachable for a refresh cycle, the rail keeps showing the previous cycle's cached cards (never blank).

**Data.**
- New table `news_cache` (`id`, `headline`, `url`, `source`, `published_at`, `summary`, `tickers` text[], `gemini_why`, `gemini_personal_template`, `inserted_at`).
- News API: **Alpha Vantage `NEWS_SENTIMENT`** (chosen because items come pre-tagged with tickers → no entity-extraction step). Free tier: 25 requests/day — well within a 6-cycle/day refresh schedule.
- New endpoint `GET /api/news?limit=5`. Personalization (which user-specific tickers to show) is rendered server-side at request time using cached `gemini_personal_template`.
- Scheduled refresh: Vercel cron job (`vercel.json`), 4h cadence, calls a private `POST /api/news/refresh`.

**MVP cut.** 5 cards, fixed 4h refresh, no per-user filtering beyond ticker overlap.

**Risk.** Gemini latency on the personalization render. **Mitigation:** the per-user sentence is generated *at refresh time* using a template (`{{ticker_list}}` placeholder) so the runtime page render is a 1ms string substitution, not an API call.

---

### F3. Portfolio health score

**User story.** I open the dashboard. I see a single 0–100 dial that tells me how healthy my portfolio is, color-coded green/yellow/red. I can tap it for the 3 reasons behind the score.

**Score formula.** Three components, each 0–100, weighted equally:
- **Diversification (33%):** `100 * (1 - HHI)` where HHI is the Herfindahl-Hirschman index of weights. (HHI = Σ wᵢ²)
- **Risk match (33%):** `100 - |realized_vol - target_vol_for_profile| * k`. Target vol mapped from `profile_label` (Steady ≤ 12%, Balanced 12–18%, Bold 18–28%).
- **Drawdown buffer (33%):** `100 * clamp(liquidity_window_months / max_drawdown_months, 0, 1)`. Uses `max_drawdown` from `optimizer.py`.

**Acceptance criteria.**
- Dial top-left of dashboard, ~140px diameter.
- Color: green ≥ 70, yellow 40–69, red < 40.
- Tap → modal with three "factor cards", each a one-line plain-English reason ("Most of your money is in 2 stocks — that's a lot of eggs in one basket").
- Score updates whenever `/api/portfolio` is called.

**Data.** Computed inline by `/api/portfolio`; returned as `{ healthScore: int, factors: [{ key, score, plainText }] }`. Math lives in `lib/healthScore.ts`. No new table.

**MVP cut.** Three factors, fixed weights, no historical trend.

---

### F4. Gamified historical lessons (demo centerpiece)

**User story.** I open "Trading School." I pick a historical event (2008, COVID-2020, 2022 inflation). Nestor shows me the world as it was, drops me into a simulated portfolio, and asks what I'd do. I choose, then I see what actually happened — and what each choice would have returned.

**Flow per lesson (4 steps).**
1. **Setup:** Date, headline montage (2–3 real headlines from the period), 1-paragraph "what's going on" written in plain English.
2. **Your portfolio:** Show the user's *actual* current portfolio, but with prices wound back to the lesson's start date.
3. **Choose:** 4 buttons — Sell most / Sell some / Hold / Buy more. Each shows expected behavior in 1 line ("Cash out — feels safe, gives up upside").
4. **Reveal:** Animated chart shows the next 12 months of actual market returns. Display outcome under each of the 4 choices side-by-side. Highlight user's choice + the optimal one. Score: +/- vs hold-all-cash.

**Lessons (3).**
- 2008 GFC (start: 2008-09-15 Lehman, end: 2009-09-15)
- COVID 2020 (start: 2020-02-19 peak, end: 2021-02-19)
- 2022 inflation (start: 2022-01-03, end: 2023-01-03)

**Acceptance criteria.**
- Each lesson runs in ≤30s for the user once they hit "Choose."
- Outcomes are deterministic: same portfolio + same choice always yields same result.
- A running "Trading School score" is stored per user across lessons.
- After all 3 lessons, show a "what you learned" summary screen.

**Data.**
- New table `historical_lessons` (`id`, `title`, `start_date`, `end_date`, `narrative`, `headlines` jsonb, `choices` jsonb) — seeded.
- New table `lesson_attempts` (`user_id`, `lesson_id`, `choice`, `score`, `played_at`).
- New endpoint `POST /api/lesson/play` — body: `{ lessonId, choice }`. Returns: `{ outcomes: [{ choice, finalValue, finalReturnPct }], userChoice, optimalChoice, score, narrative }`.
- Historical prices come from the existing Kaggle dataset (`ml/data_source.py`); compute the 4 outcomes by re-pricing the user's holdings under each choice's allocation rule.
- Choice → allocation mapping (defined per-lesson in seed data):
  - Sell most: 80% cash, 20% original
  - Sell some: 40% cash, 60% original
  - Hold: 100% original
  - Buy more: rebalance to risk-profile target with extra contribution

**MVP cut.** 3 lessons, 1 choice point each. No multi-step branching.

**Why this is the demo centerpiece.** It's the only feature that *teaches* through play. It directly hits Innovation (30%) and UX (30%), and the visual reveal is the moment a judge will remember.

---

### F5. Tax preview (simplified US)

**User story.** When I'm about to confirm a rebalance, I see the estimated tax cost before I click Execute.

**Math (simplified US, federal only).**
- Per holding being sold: realized gain = `(sell_price - cost_basis) * shares_sold`.
- Holding period from first purchase date:
  - `< 365 days`: short-term, taxed at flat **22%** (configurable in `lib/tax.ts`).
  - `≥ 365 days`: long-term, taxed at flat **15%**.
- Total estimated tax = sum over all sold lots.
- Display: `Short-term gain: $X (≈$0.22X tax). Long-term gain: $Y (≈$0.15Y tax). Estimated total: $Z. After-tax change: $W.`

**Acceptance criteria.**
- Visible above every "Execute Rebalance" button.
- Tooltip: "Simplified federal estimate. Your actual taxes depend on your bracket and state."
- If `cost_basis_date` is missing for a holding, it's treated as long-term and a footnote says "exact holding date unknown."
- Numbers update live as the user toggles which positions to include in the rebalance.

**Data.**
- Add column `cost_basis_date` (date, nullable) to existing `holdings` table.
- Tax math in `lib/tax.ts` (pure function, easy to unit-test).
- Returned as `tax_preview` field on `/api/scenario` response.

**MVP cut.** Federal flat rates only, no state, no wash sale, no FIFO/LIFO refinement (assume one purchase lot per ticker).

---

### F6. Goal-linked progress projection

**User story.** On my goals page, each goal shows me whether I'm on track — and if I'm not, a one-tap link to a rebalance that helps.

**Math (deterministic, future-value formula).**
- Inputs: current portfolio value `P`, expected annual return `r` (from risk profile: Steady 5%, Balanced 7%, Bold 9%), monthly contribution `m` (user-set on the profile or per-goal, default $200), target amount `T`.
- Future value at month `n`: `FV(n) = P*(1+r/12)^n + m * ((1+r/12)^n - 1) / (r/12)`
- Solve for `n` such that `FV(n) ≥ T` → projected_date.
- Compare to `goal.deadline`. If `projected_date > deadline`: show red, surface CTA.

**Acceptance criteria.**
- Each goal card shows: "On track to hit by **Aug 2031**" (green) or "Currently projecting **Mar 2034** — that's 18 months late." (red, with "See suggested rebalance" CTA).
- The CTA opens `/scenarios` with the goal's deadline pre-loaded as the time horizon, generating a tailored rebalance.
- If the user has no `monthly_savings_target` set, prompt for it inline before showing the projection.

**Data.**
- Add column `monthly_savings_target` (numeric, nullable) to `goals`.
- New endpoint `GET /api/goals/projection?goal_id=X` returning `{ projected_date, on_track, monthly_needed_to_be_on_time }`.
- Math in `lib/projection.ts`.

**MVP cut.** Use risk-profile-based fixed `r` (5/7/9). Don't use ML forecast for `r` in v1.

---

### F7. Natural-language scenario builder

**User story.** On the scenarios page, I can type "what if oil hits $200" and Nestor figures out what to do with my portfolio.

**Flow.**
1. Free-text input + 4 example chips ("oil hits $200", "Fed cuts rates by 1%", "tech sector drops 30%", "I lose my job for 6 months").
2. Submit → `POST /api/scenario/custom` with raw text.
3. Server: Gemini parses text into structured perturbation JSON, validated against a schema. If invalid → "I can't model that yet — try one of the examples?"
4. Run perturbation through existing `/api/scenario` machinery → return rebalance + Gemini explanation + tax preview.
5. Save to `custom_scenarios` table; show in user's recent custom scenarios list.

**Gemini contract (system prompt fixed).** Outputs JSON:
```json
{
  "perturbations": [
    { "type": "ticker|sector|index|rate|commodity", "target": "string", "direction": "up|down", "magnitude_pct": number }
  ],
  "horizon_months": number,
  "narrative": "1-sentence summary of what the user asked"
}
```

**Acceptance criteria.**
- Gemini structured output is validated against a Zod schema; on parse failure, return friendly fallback.
- Supported `type`s: ticker, sector, index, rate, commodity. Anything else → friendly rejection.
- Output rebalance reuses existing scenario UI (efficient frontier, allocation chart, suggested moves) — no separate visual treatment.
- Demo-day pre-warm: cache 4 example-chip prompts so the first click in the demo is instant.

**Data.**
- New endpoint `POST /api/scenario/custom`.
- New table `custom_scenarios` (`id`, `user_id`, `prompt`, `structured_json`, `result_summary`, `run_at`).

**MVP cut.** 5 perturbation types. Single perturbation per scenario (no compound "what if A and B"). Hard-fail anything else.

---

### F8. Click-to-learn jargon (Gemini)

**User story.** When I see a bolded colored term, I tap it and a small popup explains it in plain English.

**Pattern.** A `<Term>` React component wraps any jargon string. Renders the word in **bold + accent color + dotted underline**. On tap → popover with explanation.

**Acceptance criteria.**
- Popover renders in <200ms for cached terms (pre-warmed dictionary of ~25 common terms shipped server-side).
- For uncached terms, popover shows a skeleton + spinner; Gemini call returns in 2–4s, popover fills in.
- LocalStorage cache per session so the same user never pays the Gemini cost twice for the same term.
- Server-side cache (Supabase or in-memory Map) so users share each other's cached terms.

**Data.**
- New endpoint `POST /api/glossary` — body: `{ term: string, context?: string }`, returns `{ explanation: string }`.
- Pre-seeded terms shipped in `lib/glossary-seed.ts` for: Sharpe ratio, drawdown, volatility, allocation, rebalancing, dividend, ETF, mutual fund, P/E ratio, market cap, beta, alpha, expense ratio, capital gain, dollar-cost averaging, hedging, liquidity, correlation, diversification, bond, yield, inflation, stagflation, recession, bull/bear market.
- Component path: `components/Term.tsx`.

**MVP cut.** ~25 pre-seeded terms cover ~95% of in-app usage; Gemini fallback handles the rest.

---

## 5. Architecture diff vs. `main`

### New routes (Next.js)
- `/onboarding` — F1 quiz
- `/lessons` and `/lessons/[id]` — F4 trading school
- `/profile` — view/retake quiz, set monthly savings

### New API routes
- `POST /api/profile`, `GET /api/profile` (F1)
- `GET /api/news`, `POST /api/news/refresh` (F2)
- `POST /api/lesson/play` (F4)
- `POST /api/scenario/custom` (F7)
- `POST /api/glossary` (F8)
- `GET /api/goals/projection` (F6)

### Modified API routes
- `GET /api/portfolio` — adds `healthScore` + `factors[]` (F3)
- `POST /api/scenario` — adds `tax_preview` (F5)

### New shared modules
- `lib/profile.ts` — risk score derivation
- `lib/healthScore.ts` — F3 math
- `lib/tax.ts` — F5 math
- `lib/projection.ts` — F6 math
- `lib/glossary-seed.ts` — F8 pre-seeded terms
- `components/Term.tsx`, `components/RiskMeter.tsx`, `components/NewsRail.tsx`, `components/TaxPreview.tsx`, `components/GoalProjection.tsx`, `components/ScenarioBuilder.tsx`, `components/HistoricalLesson.tsx`

### New Supabase tables
- `user_profiles`
- `news_cache`
- `historical_lessons` (seeded)
- `lesson_attempts`
- `custom_scenarios`

### Schema additions
- `holdings`: add `cost_basis_date date NULL`
- `goals`: add `monthly_savings_target numeric NULL`

### External services
- **Gemini** (already configured) — load increases ~5x. Add per-input-hash caching in Supabase.
- **Alpha Vantage NEWS_SENTIMENT** — new. Free tier (25 req/day) is sufficient with 4h cron.
- **Vercel cron** — new. One scheduled function for news refresh.

### Python `ml/` folder
**No model changes.** Reuse `predictor.py`, `optimizer.py`, `lstm_predictor.py`, `data_source.py` as-is. F4 reads historical prices from `data_source.py`; F6 uses fixed expected returns (not the ML forecast) in v1.

---

## 6. Owner suggestions (4-person team)

| Person | Primary | Secondary |
|---|---|---|
| Dev A (frontend lead) | F1 quiz UI, F8 `<Term>` component, copywriting | Style polish across F3 / F4 |
| Dev B (frontend) | F3 health meter, F4 lesson UI (the demo centerpiece) | F6 goal projection card |
| Dev C (backend + AI) | F2 news pipeline, F7 NL scenario builder, all Gemini caching | F8 glossary endpoint |
| Dev D (backend + math) | F5 tax preview, F6 projection math, F4 outcome simulation, Supabase migrations | DB seeds for F4 |

---

## 7. Demo script (5 minutes)

1. **0:00** — Sign up as "Maya." Take risk quiz. Reveal: "The Steady Builder."
2. **0:45** — Land on dashboard. Pan: health score 78 (green), news rail with cause-effect cards. Tap a bolded "Sharpe ratio" → click-to-learn popup. Judges see the jargon-free principle in action.
3. **1:45** — Goals tab. House goal projects to "Q3 2032 — 18 months late." Tap "see rebalance."
4. **2:30** — Auto-jumps to scenarios with a tailored rebalance. Tax preview shows above Execute. Switch to natural-language input. Type "what if the Fed cuts rates by 1%" — recommendation + explanation appear.
5. **3:30** — Trading School. Play 2008 GFC: see the headlines, see Maya's portfolio in 2008 prices, choose "Hold." Reveal animation: Sell most -42%, Sell some -18%, **Hold +6%**, Buy more +28%.
6. **4:30** — Land back on dashboard. Health score nudged up. Wrap with the four judging criteria mapped onto specific moments the judge just saw.

---

## 8. Risks & mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Gemini API rate-limit / outage during demo | F2, F7, F8 break simultaneously | Per-input-hash cache in Supabase + last-known-good fallback. **Pre-warm script** runs all demo paths against the demo user's portfolio 30 min before pitch. |
| News API quota exhausted | F2 stale | 4h cron + Supabase cache + manual refresh button hidden behind a key combo for the demo |
| Demo data drift (live prices move overnight) | F4 outcomes shift, F3 score fluctuates | "Demo mode" feature flag freezes prices to a snapshot stored in Supabase for the demo user only |
| F4 outcome math wrong under unusual portfolios | Ugly numbers in the centerpiece | Demo user has a fixed seeded portfolio (5 stocks, all in Kaggle dataset) we test outcomes for end-to-end |
| Time creep | Some features ship as stubs | Cut order: drop F7 → drop F5 → reduce F4 to 2 lessons. Never cut F1, F3, F4, or F8 — those carry the demo. |
| Gemini cost overrun | $$ during dev | Cap dev spend with daily budget alarm; cache aggressively in dev too |

---

## 9. Verification plan

- **F1:** Sign up a fresh user → quiz appears → answers persist → re-login still has profile.
- **F2:** Trigger `/api/news/refresh` manually → 5 new rows in `news_cache`. Reload dashboard → cards render with the user's tickers in the personal sentence.
- **F3:** Hand-construct a deliberately concentrated portfolio (90% in one stock) → score < 40 with diversification factor flagged.
- **F4:** Play all 3 lessons end-to-end. Confirm outcomes are deterministic across reloads.
- **F5:** Add a holding bought 6 months ago + one bought 2 years ago → run a rebalance that sells both → tax preview correctly splits short-term vs long-term.
- **F6:** Set a goal with deadline 5 years out and a contribution rate that under-funds it → red warning + CTA. Bump contribution → green.
- **F7:** Submit each of the 4 example chips → all return valid rebalances. Submit nonsense → friendly rejection.
- **F8:** Click 5 different bolded terms → all return a 1–2 sentence explanation; second click on the same term returns instantly from cache.

End-to-end demo dry-run on day 4 against the seeded demo user.
