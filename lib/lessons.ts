import type { LessonChoiceOutcome } from "@/components/HistoricalLesson";
import type {
  TheoryDifficulty,
  TheoryQuestion,
} from "@/components/TheoryLesson";

export type HistoricalLessonItem = {
  kind: "historical";
  id: string;
  era: string;
  title: string;
  subtitle: string;
  blurb: string;
  scenarioContext: string;
  optimalChoice: string;
  outcomes: LessonChoiceOutcome[];
  keyTakeaway: string;
};

export type TheoryLessonItem = {
  kind: "theory";
  id: string;
  era: string;
  title: string;
  subtitle: string;
  blurb: string;
  difficulty: TheoryDifficulty;
  questions: TheoryQuestion[];
};

export type Lesson = HistoricalLessonItem | TheoryLessonItem;

export const HISTORICAL_LESSONS: HistoricalLessonItem[] = [
  {
    kind: "historical",
    id: "covid-2020",
    era: "Mar 2020",
    title: "COVID-19 Crash",
    subtitle: "The S&P 500 fell ~34% in 33 days as the pandemic shut down the economy.",
    blurb:
      "The fastest bear market in history. Markets fell off a cliff in late February as COVID lockdowns began. By late March the Fed had cut rates to zero and Congress was debating a $2T stimulus package.",
    scenarioContext:
      "It's March 23, 2020. The S&P just hit 2,237 — down 34% in 5 weeks. Schools are closed, oil futures are about to go negative, and JPMorgan is predicting -40% Q2 GDP. Your portfolio is mostly stocks. What do you do?",
    optimalChoice: "Rebalance into beaten-down sectors and add monthly",
    outcomes: [
      {
        choice: "Sell to cash, wait for clarity",
        finalReturnPct: -8.6,
        rationale:
          "Going to cash locked in losses near the bottom. Most who 'waited for clarity' missed the 50%+ rebound by year-end as they waited for headlines that never came.",
      },
      {
        choice: "Rotate into Treasuries and gold defensively",
        finalReturnPct: 3.4,
        rationale:
          "Treasuries and gold did rally as the Fed cut rates, but you missed most of the equity recovery. Better than panic-selling, far worse than staying invested.",
      },
      {
        choice: "Hold existing allocation, dollar-cost average monthly",
        finalReturnPct: 28.7,
        rationale:
          "DCA captured the entire V-shaped recovery. By December the S&P was up 16% on the year — your average cost was well below the rebound prices.",
      },
      {
        choice: "Rebalance into beaten-down sectors and add monthly",
        finalReturnPct: 41.2,
        rationale:
          "Adding to airlines, energy, and small caps near the bottom — while continuing to DCA — produced the biggest gains as cyclicals led the 2020-21 rally.",
      },
    ],
    keyTakeaway:
      "The Fed's response was the signal, not the headlines. Bear markets bottom when fear peaks — not when the news gets better. Rebalancing into weakness, rather than chasing safety, is what turns crashes into opportunities.",
  },
  {
    kind: "historical",
    id: "gfc-2008",
    era: "Sep 2008",
    title: "Global Financial Crisis",
    subtitle: "Lehman Brothers collapses and credit markets seize up.",
    blurb:
      "September 15, 2008: Lehman files for bankruptcy. AIG needs an $85B bailout. Money market funds 'break the buck'. Headlines warn of a second Great Depression — and the S&P will fall another 40% before bottoming.",
    scenarioContext:
      "Lehman is gone, Bank of America just absorbed Merrill, and the TED spread is screaming. Your 401(k) is down 25% year-to-date. Friends are pulling money out. Congress is debating TARP. You have a 20-year horizon.",
    optimalChoice: "Hold and dollar-cost average through the bottom",
    outcomes: [
      {
        choice: "Sell everything, move to FDIC-insured cash",
        finalReturnPct: -34.8,
        rationale:
          "You avoided the final 40% drop — but locked in a 25% loss and almost certainly missed the March 2009 turn. Most retail investors who went to cash didn't reinvest until 2013+, missing a doubling.",
      },
      {
        choice: "Sell only financials, keep the rest",
        finalReturnPct: -2.1,
        rationale:
          "Dumping banks dodged the worst sector — but you still owned everything else as it fell. Financials eventually recovered most losses by 2017, so you also missed that rebound.",
      },
      {
        choice: "Hold and dollar-cost average through the bottom",
        finalReturnPct: 89.4,
        rationale:
          "DCA through Sep 2008 – Mar 2009 bought shares near generational lows. By 2014 the S&P had doubled from the bottom; your blended cost basis made the gains spectacular.",
      },
      {
        choice: "Concentrate in distressed bank stocks",
        finalReturnPct: 12.3,
        rationale:
          "A handful (Wells Fargo, JPM) recovered enormously — but Citigroup lost 90%+ permanently and many regional banks went to zero. High variance, mediocre average outcome.",
      },
    ],
    keyTakeaway:
      "GFC was a generational buying opportunity disguised as a generational disaster. The lesson isn't 'be brave' — it's 'have a plan you can stick to'. Automated DCA removes the temptation to make heroic, ill-timed bets.",
  },
  {
    kind: "historical",
    id: "dotcom-2000",
    era: "Mar 2000",
    title: "Dot-Com Bubble Bursts",
    subtitle: "The Nasdaq peaks above 5,000 before losing 78% over 2.5 years.",
    blurb:
      "Pets.com just IPO'd. Cisco is the most valuable company on earth at 200x earnings. Your tech-heavy portfolio has tripled in two years and your cab driver is giving you stock tips.",
    scenarioContext:
      "It's March 2000. The Nasdaq just hit 5,048. Tech is 33% of the S&P 500. Your portfolio is 75% tech / 25% other. P/E ratios are at all-time highs and the Fed is hiking rates. What do you do?",
    optimalChoice: "Trim tech to market weight, rotate to value & dividends",
    outcomes: [
      {
        choice: "Hold the tech-heavy mix — 'this time is different'",
        finalReturnPct: -68.5,
        rationale:
          "Cisco fell 86%, Intel fell 82%, JDS Uniphase essentially went to zero. Even the Nasdaq took 15 years to recover its 2000 high in nominal terms.",
      },
      {
        choice: "Trim tech 25%, hold the rest",
        finalReturnPct: -41.2,
        rationale:
          "Better than full hold, but still way too concentrated. The remaining 50% tech weight dragged the whole portfolio down through 2002.",
      },
      {
        choice: "Trim tech to market weight, rotate to value & dividends",
        finalReturnPct: 14.6,
        rationale:
          "Value stocks (especially energy, financials, consumer staples) actually GAINED 2000–2003 while the Nasdaq cratered. Diversification away from the bubble worked beautifully.",
      },
      {
        choice: "Add to high-flyers like Cisco and Sun on the dip",
        finalReturnPct: -84.3,
        rationale:
          "Classic averaging-down trap. The 'high quality' tech leaders fell another 80%+ from March 2000. Several never recovered their highs.",
      },
    ],
    keyTakeaway:
      "When one sector dominates your portfolio because it has been winning, that's exactly the time to rebalance away from it — not the time to add. 'It's different this time' is the most expensive sentence in investing.",
  },
  {
    kind: "historical",
    id: "inflation-2022",
    era: "Jan 2022",
    title: "2022 Inflation Shock",
    subtitle: "CPI hits 7%, the Fed pivots hawkish, bonds and stocks fall together.",
    blurb:
      "After a roaring 2021, inflation is sticky at 7%+ and the Fed is signaling four rate hikes. The traditional 60/40 portfolio is about to have its worst year since 1937 as both stocks AND bonds fall.",
    scenarioContext:
      "It's January 2022. You're 60% stocks (mostly tech-heavy index funds) / 40% long-duration bonds. The Fed just signaled aggressive tightening. Real yields are turning positive. Crypto is at all-time highs and meme stocks still fly.",
    optimalChoice: "Shorten bond duration, add commodities/energy",
    outcomes: [
      {
        choice: "Stay 60/40 — 'bonds always hedge stocks'",
        finalReturnPct: -17.8,
        rationale:
          "The classic hedge broke: long bonds fell 18% as rates rose, while stocks fell 19%. The first time since 1969 that both major asset classes had double-digit losses.",
      },
      {
        choice: "Add to growth tech 'on the dip'",
        finalReturnPct: -34.6,
        rationale:
          "Long-duration tech is most sensitive to rising rates. Cathie Wood's ARKK fell 67%. Meta fell 64%. 'Buying the dip' in growth was a year-long catastrophe.",
      },
      {
        choice: "Shorten bond duration, add commodities/energy",
        finalReturnPct: 6.2,
        rationale:
          "Energy was the best-performing S&P sector (+59%), commodities outperformed broadly, and short-duration bonds barely fell. A regime-aware shift turned 2022 into a green year.",
      },
      {
        choice: "Move 100% to cash and TIPS",
        finalReturnPct: 1.4,
        rationale:
          "Cash earned ~1.5% and TIPS held value. Defensive but you missed the 2023 rebound — and timing the re-entry is its own challenge.",
      },
    ],
    keyTakeaway:
      "When the macro regime shifts (deflation → inflation, ZIRP → tightening), the asset correlations you took for granted can flip. A 60/40 isn't a magic shield — it's a bet that bonds and stocks move opposite each other, which fails during inflation shocks.",
  },
  {
    kind: "historical",
    id: "brexit-2016",
    era: "Jun 2016",
    title: "Brexit Vote Surprise",
    subtitle: "UK votes to leave the EU — global markets drop 5% in two days.",
    blurb:
      "The pound crashes 8% to a 30-year low on June 24. The FTSE 250 drops 14% in two days. Pundits predict a long European recession and a UK depression.",
    scenarioContext:
      "It's the morning of June 27, 2016. Brexit passed unexpectedly. Cameron has resigned, sterling is in freefall, and your globally diversified portfolio is down 4% over the weekend. Headlines are uniformly apocalyptic.",
    optimalChoice: "Hold global allocation, do nothing",
    outcomes: [
      {
        choice: "Sell all UK & European exposure",
        finalReturnPct: -7.2,
        rationale:
          "UK and EU stocks recovered within weeks. Selling locked in losses and missed the rebound. The FTSE 100 actually hit new highs by October.",
      },
      {
        choice: "Hedge by buying gold and Treasuries",
        finalReturnPct: 1.8,
        rationale:
          "Gold did pop on the panic — but the rally was over within a month. Hedges put on AFTER the news rarely pay; the price already reflects the fear.",
      },
      {
        choice: "Hold global allocation, do nothing",
        finalReturnPct: 11.4,
        rationale:
          "By December the MSCI World was up 8% from the Brexit low. Your discipline let compounding do its work without you trying to outguess Article 50 negotiations.",
      },
      {
        choice: "Buy UK assets aggressively on the dip",
        finalReturnPct: 16.8,
        rationale:
          "FTSE 100 multinationals (HSBC, Shell, AstraZeneca) actually BENEFITED from a weaker pound — most revenues are in dollars/euros. The 'crisis' helped them.",
      },
    ],
    keyTakeaway:
      "Political surprises feel terminal in the moment but rarely change underlying earnings power. The instinct to 'do something' on shock days is usually wrong — markets price the panic faster than you can react to it.",
  },
  {
    kind: "historical",
    id: "blackmonday-1987",
    era: "Oct 1987",
    title: "Black Monday",
    subtitle: "The Dow falls 22.6% in a single day — the largest one-day drop ever.",
    blurb:
      "October 19, 1987: program trading and portfolio insurance trigger a cascading sell-off. The Dow loses more in one day than it did during the entire 1929 crash. There's no obvious fundamental cause.",
    scenarioContext:
      "It's October 20, 1987 — Tuesday morning. The Dow closed at 1,738 yesterday, down 508 points. Phones at brokerages are ringing off the hook. There's no recession, no bank failure, no war — just a mechanical liquidity collapse. What now?",
    optimalChoice: "Hold and add — earnings haven't changed",
    outcomes: [
      {
        choice: "Sell everything before more chaos",
        finalReturnPct: -18.4,
        rationale:
          "By year-end 1988 the market had recovered most losses. Selling at Tuesday's open meant booking a 22% loss right before a 16% rebound year.",
      },
      {
        choice: "Trim to 50% equities",
        finalReturnPct: -3.6,
        rationale:
          "Better than full liquidation, but still gave up significant upside. The 1988-89 bull resumed quickly; half-positioning halved your participation.",
      },
      {
        choice: "Hold full equity allocation",
        finalReturnPct: 14.7,
        rationale:
          "By end of 1989 the Dow was at 2,753 — a 58% gain from the Black Monday low. Holding through the panic captured the full rebound and the next 5 years of bull market.",
      },
      {
        choice: "Hold and add — earnings haven't changed",
        finalReturnPct: 28.5,
        rationale:
          "Companies' earnings, dividends, and book values were unchanged Tuesday morning vs. Friday afternoon. Buying the mechanical panic at 1987 prices was one of the best entries of the decade.",
      },
    ],
    keyTakeaway:
      "Not every crash is a fundamental crisis — some are pure liquidity events. When the news hasn't changed but the price has, that's the textbook definition of a buying opportunity. The hard part is acting on it when everyone around you is panicking.",
  },
];

export const THEORY_LESSONS: TheoryLessonItem[] = [
  // ────────────── BEGINNER ──────────────
  {
    kind: "theory",
    id: "investing-101",
    era: "Concept",
    difficulty: "Beginner",
    title: "Investing 101",
    subtitle: "Start here — the absolute basics.",
    blurb:
      "Before strategy comes vocabulary. Make sure you can confidently say what a stock, bond, and ETF actually are.",
    questions: [
      {
        prompt: "What does it mean to own a share of stock in a company?",
        options: [
          "You've loaned the company money and they owe you interest",
          "You own a small piece of the company and share in its profits or losses",
          "You're guaranteed a fixed return each year",
          "You're insured against the company's debts",
        ],
        correctIndex: 1,
        explanation:
          "Stocks = equity. You're a part-owner with claim on profits (dividends) and price appreciation, and you bear losses if the company struggles.",
      },
      {
        prompt: "What is a bond?",
        options: [
          "A part-ownership stake in a company",
          "A loan you make to a company or government, repaid with interest",
          "A type of insurance policy",
          "A savings account at a brokerage",
        ],
        correctIndex: 1,
        explanation:
          "When you buy a bond, you're the lender. The issuer pays you interest (the coupon) and returns your principal at maturity.",
      },
      {
        prompt: "What is an ETF (Exchange-Traded Fund)?",
        options: [
          "A single stock that trades on multiple exchanges",
          "A basket of many investments you can buy as one ticker, traded on exchanges like a stock",
          "A type of bond issued by foreign governments",
          "A mutual fund that only trades after-hours",
        ],
        correctIndex: 1,
        explanation:
          "An ETF bundles many holdings (stocks, bonds, etc.) into one tradeable unit — instant diversification with the convenience of a single trade.",
      },
      {
        prompt: "Why do most people invest instead of just saving cash?",
        options: [
          "Investing is always safer than cash",
          "Stocks are guaranteed to go up over 5 years",
          "Long-term, investments tend to grow faster than cash, beating inflation",
          "Banks charge fees on savings",
        ],
        correctIndex: 2,
        explanation:
          "Cash loses purchasing power to inflation. Investing accepts short-term volatility in exchange for long-term growth that historically beats inflation.",
      },
    ],
  },
  {
    kind: "theory",
    id: "diversification",
    era: "Concept",
    difficulty: "Beginner",
    title: "Diversification & Risk",
    subtitle: "Don't put all your eggs in one basket — but know why.",
    blurb:
      "Diversification is the only free lunch in investing. These questions test whether you really understand what it does and doesn't do.",
    questions: [
      {
        prompt: "Which portfolio is the most diversified?",
        options: [
          "20 different US tech stocks",
          "An S&P 500 index fund",
          "A global mix of stocks, bonds, and real estate across regions",
          "10 high-dividend stocks from different sectors",
        ],
        correctIndex: 2,
        explanation:
          "True diversification spans asset classes, geographies, and risk factors — not just individual tickers within one sector or one country.",
      },
      {
        prompt:
          "In a market-wide crash (like March 2020), what does diversification protect you from?",
        options: [
          "All losses — that's the whole point",
          "Stock-specific risk, but not market risk",
          "Only inflation",
          "Nothing in the short term",
        ],
        correctIndex: 1,
        explanation:
          "Diversification reduces idiosyncratic (single-stock) risk. Systematic risk — the whole market falling together — can't be diversified away with stocks alone.",
      },
      {
        prompt: "Why might holding 100 stocks not be much safer than holding 30?",
        options: [
          "Most diversification benefit is captured by ~20–30 well-chosen stocks; more adds little",
          "Because broker fees eat the difference",
          "Because 100 stocks is too many to track",
          "Because more stocks always increases risk",
        ],
        correctIndex: 0,
        explanation:
          "Volatility reduction from adding stocks flattens out quickly. Past ~30 holdings, you're mostly adding complexity, not safety.",
      },
    ],
  },
  {
    kind: "theory",
    id: "stocks-bonds-basics",
    era: "Concept",
    difficulty: "Beginner",
    title: "Stocks vs Bonds",
    subtitle: "Know what each asset class is supposed to do.",
    blurb:
      "Stocks and bonds play different roles in your portfolio. Mixing them up is one of the most common beginner mistakes.",
    questions: [
      {
        prompt:
          "A typical 'balanced' portfolio is often described as 60/40. What does that mean?",
        options: [
          "60% US / 40% international",
          "60% stocks / 40% bonds",
          "60% growth / 40% value",
          "60% taxable / 40% tax-advantaged",
        ],
        correctIndex: 1,
        explanation:
          "60% equities for growth, 40% bonds for stability. The bond sleeve is meant to cushion stock drawdowns — though it can fail when both fall together (e.g., 2022).",
      },
      {
        prompt: "Why might a young investor hold mostly stocks instead of bonds?",
        options: [
          "Stocks always go up",
          "Bonds are too complicated",
          "Long time horizon lets them ride out volatility for higher expected returns",
          "Bonds are illegal under age 30",
        ],
        correctIndex: 2,
        explanation:
          "Stocks are more volatile but historically deliver higher long-term returns. With 30+ years to recover from drawdowns, the expected return advantage outweighs the bumpiness.",
      },
      {
        prompt:
          "Generally, as someone approaches retirement, their allocation should shift to:",
        options: [
          "More aggressive — they need higher returns",
          "More bonds and less stocks — to protect against late-career drawdowns",
          "Stay the same throughout life",
          "100% cash, always",
        ],
        correctIndex: 1,
        explanation:
          "Shorter time horizons mean less ability to recover from a crash. The classic glide path gradually shifts toward bonds and cash as retirement nears.",
      },
    ],
  },

  // ────────────── INTERMEDIATE ──────────────
  {
    kind: "theory",
    id: "compounding",
    era: "Concept",
    difficulty: "Intermediate",
    title: "Compound Interest",
    subtitle: "Why time in the market beats timing the market.",
    blurb:
      "Einstein called compound interest the eighth wonder of the world. These questions test whether you really feel its power.",
    questions: [
      {
        prompt:
          "$10,000 invested at 8% annually. How much do you have after 30 years (no contributions)?",
        options: ["$24,000", "$58,000", "~$100,600", "$240,000"],
        correctIndex: 2,
        explanation:
          "$10,000 × 1.08^30 ≈ $100,627. Compounding turns a 10x intuition into something closer to 10x — most people underestimate it dramatically.",
      },
      {
        prompt:
          "Investor A puts in $5k/year from age 25–35 then stops. Investor B puts in $5k/year from 35–65. Both earn 8%. Who has more at 65?",
        options: [
          "Investor A — earlier money compounds longer",
          "Investor B — they contributed 3x more total",
          "They end up roughly equal",
          "Depends on tax bracket",
        ],
        correctIndex: 0,
        explanation:
          "Investor A contributes $50k total but ends with ~$615k. Investor B contributes $150k total and ends with ~$566k. Starting early matters more than contributing more.",
      },
      {
        prompt: "What's the 'Rule of 72'?",
        options: [
          "You should save 72% of bonuses",
          "Divide 72 by your annual return % to estimate years to double your money",
          "Retirement is best at age 72",
          "Stocks return 7.2% on average",
        ],
        correctIndex: 1,
        explanation:
          "At 8% returns, money doubles roughly every 72/8 = 9 years. It's a quick mental shortcut for the power of compounding.",
      },
    ],
  },
  {
    kind: "theory",
    id: "inflation-real-returns",
    era: "Concept",
    difficulty: "Intermediate",
    title: "Inflation & Real Returns",
    subtitle: "Nominal returns lie. Real returns tell the truth.",
    blurb:
      "If your portfolio earns 5% but inflation is 6%, you got poorer. Inflation is the silent tax most beginners forget.",
    questions: [
      {
        prompt:
          "Your savings account pays 4%. Inflation is 5%. What's your real return?",
        options: ["+9%", "+4%", "-1%", "0%"],
        correctIndex: 2,
        explanation:
          "Real return ≈ nominal return − inflation. 4% − 5% = −1%. Your dollars grew, but their purchasing power shrank.",
      },
      {
        prompt: "Which has historically been the worst hedge against inflation?",
        options: [
          "Stocks",
          "Real estate",
          "Long-duration government bonds at low rates",
          "Commodities",
        ],
        correctIndex: 2,
        explanation:
          "Long bonds are punished by rising rates and inflation — fixed coupons lose purchasing power. Stocks, real estate, and commodities have generally fared better over multi-decade horizons.",
      },
      {
        prompt:
          "Why is keeping 'all your savings in cash' often considered risky long-term?",
        options: [
          "Banks can fail",
          "Cash steadily loses purchasing power to inflation",
          "Cash earns no taxes",
          "It's not — cash is the safest asset",
        ],
        correctIndex: 1,
        explanation:
          "$100,000 in cash today buys roughly $74,000 worth of goods after 10 years at 3% inflation. Cash feels safe but bleeds value silently.",
      },
    ],
  },
  {
    kind: "theory",
    id: "fees-taxes",
    era: "Concept",
    difficulty: "Intermediate",
    title: "Fees, Taxes & Drag",
    subtitle: "What you keep matters more than what you earn.",
    blurb:
      "A 1% fee sounds tiny. Over 30 years it can eat a quarter of your final balance. Let's make sure you see it.",
    questions: [
      {
        prompt:
          "Two funds return 8% gross. Fund A charges 0.05%, Fund B charges 1.0%. Over 30 years on $100k, the difference is closest to:",
        options: ["~$5,000", "~$25,000", "~$200,000", "~$1,000"],
        correctIndex: 2,
        explanation:
          "Fund A grows to ~$991k, Fund B to ~$761k — about $230k lost to fees. Small percentages compound just like returns do.",
      },
      {
        prompt: "What's the typical advantage of a long-term capital gain over a short-term one?",
        options: [
          "Long-term gains are taxed at lower rates than ordinary income",
          "Long-term gains are tax-free",
          "There's no difference",
          "Short-term gains get a deduction",
        ],
        correctIndex: 0,
        explanation:
          "In the US, holding more than a year qualifies for preferential long-term capital gains rates (0/15/20%) vs. ordinary income rates that can exceed 37%.",
      },
      {
        prompt: "What is 'tax-loss harvesting'?",
        options: [
          "Selling losers to offset taxable gains and reduce your tax bill",
          "Avoiding taxes by never selling",
          "Only investing in tax-free municipal bonds",
          "Donating losing stocks to charity",
        ],
        correctIndex: 0,
        explanation:
          "Realizing losses lets you offset capital gains (and up to $3k of ordinary income/year in the US). You can rebuy a similar — but not 'substantially identical' — security to stay invested.",
      },
    ],
  },
  {
    kind: "theory",
    id: "behavioral",
    era: "Concept",
    difficulty: "Intermediate",
    title: "Behavioral Pitfalls",
    subtitle: "Your worst enemy is usually in the mirror.",
    blurb:
      "Investing isn't just math — it's psychology. Recognizing these biases is the first step to avoiding expensive mistakes.",
    questions: [
      {
        prompt:
          "You buy a stock at $100. It drops to $70. Selling now would 'lock in the loss', so you hold on hoping to break even. What bias is this?",
        options: [
          "Confirmation bias",
          "Loss aversion / disposition effect",
          "Herding",
          "Anchoring on dividends",
        ],
        correctIndex: 1,
        explanation:
          "We feel losses ~2x as strongly as equivalent gains, leading us to hold losers too long and sell winners too early. The market doesn't care what you paid.",
      },
      {
        prompt:
          "A friend tells you everyone is buying a hot crypto coin. You jump in without research. This is:",
        options: [
          "Rational — crowds know best",
          "Herding behavior — often a sign of late-stage bubbles",
          "Diversification",
          "Dollar-cost averaging",
        ],
        correctIndex: 1,
        explanation:
          "When 'everyone' is buying, the easy money has usually already been made. Bubbles end with the last marginal buyer — be careful when you're that buyer.",
      },
      {
        prompt:
          "Studies of retail traders consistently find that more frequent trading leads to:",
        options: [
          "Higher returns from being agile",
          "Lower returns due to fees, taxes, and bad timing",
          "No effect — it averages out",
          "Higher returns only on Mondays",
        ],
        correctIndex: 1,
        explanation:
          "Barber & Odean's classic studies show the most active traders underperform the market by several percentage points per year. Doing less is often doing more.",
      },
      {
        prompt: "What's the simplest defense against most behavioral biases?",
        options: [
          "Watch CNBC daily for tips",
          "A written investment plan + automatic contributions you don't manually adjust",
          "Trade only on weekends",
          "Read more news",
        ],
        correctIndex: 1,
        explanation:
          "Pre-committing to a plan removes in-the-moment emotion. Automation enforces consistency through the bull markets and the panics alike.",
      },
    ],
  },

  // ────────────── ADVANCED ──────────────
  {
    kind: "theory",
    id: "risk-adjusted-returns",
    era: "Concept",
    difficulty: "Advanced",
    title: "Risk-Adjusted Returns",
    subtitle: "Sharpe, Sortino, beta, alpha — measuring what you actually earned.",
    blurb:
      "A 20% return with 40% volatility isn't better than a 12% return with 10% volatility. These metrics help you compare apples to apples.",
    questions: [
      {
        prompt:
          "A portfolio returns 12% with 15% standard deviation. The risk-free rate is 3%. What's its Sharpe ratio?",
        options: ["0.6", "0.8", "1.2", "1.8"],
        correctIndex: 0,
        explanation:
          "Sharpe = (Return − Risk-free) / StDev = (12 − 3) / 15 = 0.6. A Sharpe above 1 is generally considered good; above 2 is excellent.",
      },
      {
        prompt:
          "A stock has a beta of 1.5 vs the S&P 500. If the S&P gains 10%, what's the expected move?",
        options: [
          "+10% — beta only matters in down markets",
          "+15% — it tends to amplify market moves by 1.5x",
          "+5% — it's defensive",
          "-15% — it's inversely correlated",
        ],
        correctIndex: 1,
        explanation:
          "Beta measures sensitivity to market moves. β=1.5 means roughly 1.5x the market's return (and 1.5x the drawdown — it cuts both ways).",
      },
      {
        prompt:
          "What does 'alpha' represent in modern portfolio theory?",
        options: [
          "Total return minus inflation",
          "The portion of return not explained by market exposure (skill or luck)",
          "Volatility above the benchmark",
          "Dividend yield minus the risk-free rate",
        ],
        correctIndex: 1,
        explanation:
          "Alpha is the excess return after adjusting for risk taken (beta). Most active managers fail to deliver positive alpha after fees over long periods.",
      },
      {
        prompt:
          "How does the Sortino ratio differ from the Sharpe ratio?",
        options: [
          "It's the same — different name",
          "Sortino only penalizes downside volatility, not upside swings",
          "Sortino uses median instead of mean returns",
          "Sortino is for bonds, Sharpe is for stocks",
        ],
        correctIndex: 1,
        explanation:
          "Sharpe penalizes ALL volatility (including upside). Sortino only penalizes returns below a threshold — arguably a better measure since investors don't mind upside vol.",
      },
    ],
  },
  {
    kind: "theory",
    id: "macro-yield-curve",
    era: "Concept",
    difficulty: "Advanced",
    title: "Macroeconomics & The Yield Curve",
    subtitle: "Read the signals the bond market is sending.",
    blurb:
      "The yield curve has predicted every US recession since 1955 — but with variable lag. Understanding it makes you a more informed investor.",
    questions: [
      {
        prompt: "What does an 'inverted yield curve' mean?",
        options: [
          "Bond prices have fallen below par",
          "Short-term Treasury yields are higher than long-term yields",
          "The Fed has cut rates to zero",
          "Foreign bonds outyield US bonds",
        ],
        correctIndex: 1,
        explanation:
          "Normally long bonds yield more (term premium). When short rates exceed long rates, the market is signaling expected future rate cuts — usually because of recession fears.",
      },
      {
        prompt:
          "When the Fed RAISES the federal funds rate, what typically happens to long-duration bond prices?",
        options: [
          "They rise — higher yields are bullish",
          "They fall — existing bonds become less attractive vs new higher-rate bonds",
          "They're unaffected — only short bonds matter",
          "They become tax-exempt",
        ],
        correctIndex: 1,
        explanation:
          "Bond prices and yields move inversely. Long-duration bonds are most sensitive — a 30-year Treasury can lose 20%+ on a 1% rate hike.",
      },
      {
        prompt:
          "The Fed's 'dual mandate' targets which two outcomes?",
        options: [
          "Stock market growth and GDP",
          "Maximum employment and stable prices (inflation around 2%)",
          "Currency strength and trade surplus",
          "Bank profitability and consumer confidence",
        ],
        correctIndex: 1,
        explanation:
          "The Federal Reserve Act mandates max employment + price stability. The 2% inflation target is interpreted, not statutory, but has anchored expectations since the 1990s.",
      },
      {
        prompt:
          "Which of these typically signals a deflationary shock (not inflationary)?",
        options: [
          "Sharp commodity price drops + falling consumer demand",
          "Wage growth above 5%",
          "Currency devaluation",
          "Quantitative easing programs",
        ],
        correctIndex: 0,
        explanation:
          "Deflation = falling prices, often from collapsing demand (think 2008 or Japan in the '90s). Cash gains real purchasing power, but debtors and earnings get crushed.",
      },
    ],
  },
  {
    kind: "theory",
    id: "options-derivatives",
    era: "Concept",
    difficulty: "Advanced",
    title: "Options & Derivatives",
    subtitle: "Calls, puts, IV, and the strategies built on them.",
    blurb:
      "Options can hedge risk or amplify it dramatically. These questions cover the foundational concepts before you trade your first contract.",
    questions: [
      {
        prompt:
          "You buy a CALL option on a stock at strike $100. The stock rises to $120 by expiration. What's the intrinsic value at expiration?",
        options: ["$0", "$10", "$20", "$120"],
        correctIndex: 2,
        explanation:
          "A call gives you the right to buy at strike. Intrinsic value = max(0, Stock − Strike) = max(0, 120 − 100) = $20 per share. Your profit also depends on the premium you paid.",
      },
      {
        prompt: "A PUT option is most useful when you want to:",
        options: [
          "Bet on a stock going up",
          "Hedge against or profit from a price decline",
          "Earn dividends",
          "Borrow shares to short",
        ],
        correctIndex: 1,
        explanation:
          "Puts give you the right to SELL at the strike price. Buying a put profits when the stock falls — often used as portfolio insurance.",
      },
      {
        prompt: "What does 'implied volatility' (IV) measure?",
        options: [
          "Past stock price swings",
          "The market's expected future volatility, derived from option prices",
          "Trading volume in the option",
          "The risk-free rate",
        ],
        correctIndex: 1,
        explanation:
          "IV is the volatility number that, plugged into Black-Scholes, gives the current option price. High IV = expensive options = market expects big moves.",
      },
      {
        prompt:
          "You sell a covered call against 100 shares you own. Your maximum loss is:",
        options: [
          "Limited to the premium received",
          "Unlimited — you're short an option",
          "The stock falling to zero, minus the premium received",
          "The strike price",
        ],
        correctIndex: 2,
        explanation:
          "You still own the underlying shares — they can fall to zero. The premium gives you a small cushion. Covered calls cap upside (you give up gains above strike) for income.",
      },
      {
        prompt: "Which of these option Greeks measures sensitivity to time decay?",
        options: ["Delta", "Gamma", "Theta", "Vega"],
        correctIndex: 2,
        explanation:
          "Theta measures how much an option loses in value per day, all else equal. Long option holders 'pay theta' daily; sellers collect it.",
      },
    ],
  },
];

export const ALL_LESSONS: Lesson[] = [
  ...HISTORICAL_LESSONS,
  ...THEORY_LESSONS,
];
