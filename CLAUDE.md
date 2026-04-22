# CLAUDE.md — Business Sim

## The vision

A business strategy game played on a dashboard. The user sets a goal ("hit $5M ARR in 24 months, never run out of cash"), composes their business from familiar pieces (products, channels, stores, reps, segments), and pulls levers (price, hire rate, marketing spend) to try to maximise the probability of hitting the goal. Every change triggers a Monte Carlo simulation that plays out on the screen as an animated fan chart — hundreds of possible futures drawing themselves across the horizon, with a "probability of winning" gauge updating live.

Think Civilization, but the map is a business and the turns are "adjust lever, press Run, watch the next thousand possible futures unfold." Simple, intuitive, slightly addictive. The kind of tool where the user says "one more tweak" and loses an hour.

## Design principles

1. **Play before precision.** If it's not fun to use, nobody will use it to learn anything. Precision comes second.
2. **Levers, not equations.** The user pulls levers with clear names ("hire one more rep", "raise price 10%"). The math lives underneath.
3. **Instant feedback.** Every adjustment produces a visible result in under half a second. Deterministic preview is instant (same thread); full Monte Carlo runs in a web worker with an animated reveal.
4. **One screen.** The main dashboard shows goal, levers, chart, and win probability simultaneously. No navigation mid-play.
5. **Good defaults, deep customisation.** A new user picks a template and starts playing in 60 seconds. A power user can open the hood and redefine any primitive.
6. **Show the distribution, not the forecast.** The fan chart is the protagonist. Single-point forecasts are a lie we're not telling.
7. **Zero backend.** The whole app is a static single-page site. Every interaction is local. This is non-negotiable for the feel we want.
8. **Business-aware defaults.** A SaaS founder sees churn and LTV/CAC. A restaurateur sees covers, food cost %, and table turnover. The app speaks the user's language from the first interaction.

## The game loop

```
1. Answer the profiler    (business type, stage, key characteristics → auto-generated scenario)
   — OR pick a template   (shortcut for experienced users)
2. Review your model      (profiler-generated primitives, defaults, and goals)
3. Set / adjust goals     (target outcome + horizon + constraints)
4. Look at levers         (current probability of winning shown)
5. Adjust a lever         (slider, toggle, number input)
6. Press Run              (Monte Carlo animates across the chart)
7. Read the result        (probability, distribution, financials, which runs failed and why)
8. Check "Next move"      (sensitivity analysis highlights highest-impact lever)
9. Repeat from 5          (until probability of winning feels good enough)
10. Save scenario         (compare alternatives)
```

The play loop (steps 5–9) should close in under 15 seconds on a typical model. That cycle time is what makes it a game instead of a chore.

## Core game pieces (primitives)

Users compose a business from these high-level primitives. Each primitive auto-generates the underlying stocks, flows, and variables so the user never has to think in those terms unless they want to.

### Product
- Price (variable)
- Unit COGS (variable)
- Contribution margin = derived
- Price elasticity (optional — demand responds to price changes)
- Launch period (when it starts selling)

### Market & Segment
- Total addressable market (units or $)
- Market share (current + growth assumption)
- Segment size (variable — can grow/shrink)
- Our share of segment (stock — accumulates from flows)

### Sales Channel
- Channel type (direct sales / retail / online / wholesale / partner)
- Capacity cap (e.g. "$500k revenue per store per year")
- Conversion rate or win rate
- Channel cost (fixed + variable)
- Ramp time to full capacity

### Store / Location / Unit
- Fixed monthly cost (rent, utilities, baseline staff)
- Revenue capacity cap
- Ramp curve (new stores take N months to reach steady state)
- Opening/closing plan (scheduled additions of physical units)

### Sales Rep / Team
- Count, fully-loaded cost
- Ramp curve to productivity
- Quota + hit-rate probability (Bernoulli per period)
- Attrition probability
- Revenue contribution at full productivity

### Ad / Marketing Channel
- Spend (lever)
- CAC (constant, trending, or diminishing-returns function of spend)
- Attribution window
- Diminishing returns curve (optional: `CAC = base * (1 + spend/threshold)^k`)

### Customer Cohort
- Acquisition rate (flow in)
- Churn probability (flow out)
- Revenue per customer per period
- Expansion / upsell rate
- Cohort age (drives behaviour)
- Billing frequency (monthly / annual / upfront — affects cash timing vs revenue recognition)
- Payment terms (DSO — when cash actually arrives after invoice)

### Headcount (non-sales)
- Role, count, salary, on-costs multiplier
- Ramp, attrition
- Function (ops / eng / admin — cost centre, no direct revenue)
- Recruitment cost per hire (one-time, variable — shows on income statement when incurred)
- Auto-scaling option: support/ops headcount can scale with customer count via formula reference (see Feedback Loops)

### Working Capital & Payment Terms
- Days Sales Outstanding (DSO) — how long before customers pay
- Days Payable Outstanding (DPO) — how long before you pay suppliers
- Days Inventory Outstanding (DIO) — how long inventory sits before sale
- Cash conversion cycle = DSO + DIO − DPO (derived)
- Billing frequency (monthly / quarterly / annual / upfront)
- These parameters offset cash flows from the income statement recognition, making visible the difference between "profitable" and "has cash"

### Scaling Cost Trigger
- Trigger metric (customer count, order volume, headcount, revenue)
- Threshold (e.g. "at 10,000 customers" or "at 50 employees")
- Cost type: one-time (e.g. new warehouse lease) or recurring step-up
- Amount (variable)
- Examples: new warehouse at 10k orders/month, dedicated HR hire at 50 staff, enterprise support tier at 500 customers, second shift in manufacturing at 80% capacity

### Fixed Asset
- Name, purchase cost, useful life (months)
- Depreciation method (straight-line default)
- Purchase schedule (piecewise — ties to store openings, capacity expansion)
- Appears on balance sheet as asset; depreciation flows through income statement
- Capex shows on cash flow statement when purchased, not when depreciated

### Debt Facility
- Principal, interest rate, term (months)
- Draw-down schedule or revolving credit limit
- Appears on balance sheet as liability, interest on income statement, principal movements on cash flow statement
- Enables modelling of growth funded by debt vs equity vs organic cash flow

### Financial primitives (auto-created)
- Cash stock (every scenario has one)
- Revenue flow (sum of all revenue contributions)
- COGS flow (sum of unit COGS × units)
- OpEx flow (headcount + marketing + fixed costs)
- Profit = Revenue − COGS − OpEx (derived)
- Contribution margin $ = Revenue − COGS (derived)
- Contribution margin % = derived
- Three-way financial statements (income statement, balance sheet, cash flow statement) — auto-derived from all primitives each period (see Three-Way Financial Statements section)

## Variables — the adjustable knobs

Every numeric input in a primitive is a **Variable** and can be set to any of these kinds:

| Kind | Use when | Example |
|---|---|---|
| `constant` | Steady assumption | Price = $99 |
| `linear_trend` | Drifts up or down | CAC rising $5/month |
| `exponential` | Compounding | Market growing 2%/month |
| `step` | Changes at a known date | Price jumps at month 6 |
| `seasonal` | Oscillates | Retail with December peak |
| `stochastic` | Uncertain | CAC ~ Normal(400, 50) |
| `piecewise` | Known trajectory | Hiring plan per month |
| `elasticity` | Responsive | Units = f(price) |
| `formula` | Depends on other variables | Churn = f(customer count, support headcount) |

The UI shows a small sparkline preview of every variable's trajectory and, for stochastic variables, the distribution shape. Changing kind is one click — a variable can start life as a constant and be promoted to stochastic when the user wants to stress-test it.

### Key variables to expose as defaults
- **Price**, **Unit COGS**, **Contribution margin** (auto-derived)
- **Units sold** (per product per period — output of channel capacity × conversion)
- **Profit margin** (derived, but targetable)
- **Market size**, **Market share**, **Share of wallet**
- **CAC**, **LTV**, **Payback period**
- **Revenue per store / per rep / per channel** (with caps)
- **Churn rate**
- **Sales cycle length**
- **Win rate** (deals closed / deals in pipeline)

## Feedback loops — how primitives interact

Business models have reinforcing and balancing loops. Without these, the simulation is just independent projections summed together — a spreadsheet with dice. The engine supports cross-primitive dependencies via formula variables.

### How it works

Any Variable can use kind `"formula"` with an expression that references other primitives' outputs. The engine resolves these via topological sort each timestep (two-pass: all non-formula variables first, then formula variables in dependency order).

### Built-in loop patterns

| Loop | Type | Mechanism |
| --- | --- | --- |
| Growth flywheel | Reinforcing | More customers → more revenue → more cash → hire more reps → more customers |
| Support load | Balancing | More customers → support headcount scales → higher OpEx → lower margin |
| Price sensitivity | Balancing | Higher price → lower conversion rate → fewer new customers |
| Diminishing returns | Balancing | More ad spend → higher marginal CAC → lower ROI per $ |
| Word of mouth | Reinforcing | More customers → organic referrals → lower blended CAC |
| Churn pressure | Balancing | Rapid growth → less onboarding attention per customer → higher churn |
| Working capital drag | Balancing | Faster growth → more cash tied up in receivables/inventory → cash crunch |

### Formula syntax (simple, not a full language)

- References: `segment.customers`, `product.price`, `channel.conversion`
- Operators: `+`, `-`, `*`, `/`, `min()`, `max()`, `clamp()`
- Conditionals: `if(metric > threshold, valueA, valueB)`
- The profiler auto-wires common loops for each business type (see Business Profiler)

### Engine implications

Variable resolution becomes two-pass per timestep:

1. Resolve all non-formula variables (constants, trends, stochastic, etc.)
2. Topological-sort formula variables by dependency, then evaluate in order

This is still O(V) per timestep where V = number of variables. Circular dependencies are detected at scenario compile time and rejected with a clear error. For typical models (< 50 formula variables), overhead is negligible.

## Constraints

Constraints are first-class. Unlike variables, they are ceilings the system respects.

- **Capacity caps**: revenue per store, deals per rep per month, units producible per month, customers serviceable per CS rep
- **Market size**: cannot acquire more customers than TAM allows
- **Budget caps**: marketing spend cannot exceed X% of revenue, or a hard ceiling
- **Cash constraint**: cannot spend what you don't have (optional — enable to model real-world funding limits)

When a constraint binds, the UI flags it. "You hit store capacity in month 14 — revenue flatlines until you open more stores." This is how users learn what their real bottleneck is.

## Unit economics — first-class outputs

The simulation auto-derives unit economics metrics from existing primitives and surfaces them as a coherent analytical view. These are not inputs the user sets — they emerge from the model and update with every run.

### Metrics computed per period (and across the MC distribution)

- **CAC** (blended) = total acquisition spend / new customers acquired
- **LTV** = ACV / churn rate (simple) or NPV of cohort revenue curve (detailed)
- **LTV/CAC ratio** — the master metric; < 1 means you're losing money on every customer you acquire
- **Payback period** = CAC / (monthly revenue per customer × gross margin %)
- **Contribution margin per customer** = revenue per customer − variable cost per customer
- **Cohort revenue curve** — revenue from a cohort as it ages (expansion, contraction, churn)
- **Gross margin %** = (Revenue − COGS) / Revenue
- **Burn multiple** = net burn / net new ARR (SaaS-specific, hidden for other archetypes)
- **Revenue per employee** = total revenue / total headcount
- **Cash conversion cycle** = DSO + DIO − DPO (days; from Working Capital primitive)

### Unit economics display

- Dedicated "Unit Economics" tab alongside the fan chart
- Key metrics shown as sparkline time series with P10–P90 bands
- Cohort analysis heatmap (rows = cohort month, columns = age, cells = revenue)
- Automatically adapts vocabulary and visible metrics to business type (see Business Profiler)
- Restaurant shows "contribution per cover" and "food cost %"; SaaS shows "LTV/CAC" and "burn multiple"

## Three-way financial statements

The simulation auto-generates linked financial statements from the model primitives. Users never manually build these — they emerge from the business model and update with every simulation run.

### Why this matters

The three statements make the INTERACTIONS between decisions visible in ways a single P&L cannot:

- **"Profitable but broke"** — income statement shows profit, but cash flow statement shows negative operating CF because receivables are growing faster than revenue (fast-growing B2B SaaS with annual contracts and net-60 terms)
- **"Growing but deteriorating"** — revenue up, but balance sheet shows ballooning inventory and receivables eating all the cash (wholesale trader scaling too fast)
- **"Efficient but fragile"** — lean balance sheet with no cash buffer for a bad month (services firm with high utilisation but no reserves)
- **"Revenue ≠ cash"** — restaurant with great daily sales but massive upfront fitout debt dragging cash flow (common for new locations)

### Income Statement (per period)

```text
Revenue (sum of all product × units flows)
− COGS (sum of unit costs × units)
= Gross Profit
− Operating Expenses
    Salaries & wages (all headcount — sales, ops, eng, admin)
    Marketing & advertising (all ad channel spend)
    Rent & occupancy (store fixed costs)
    Recruitment costs (new hires × cost per hire)
    Other fixed costs
= EBITDA
− Depreciation & Amortisation (from Fixed Assets)
= EBIT
− Interest expense (from Debt Facilities)
= Pre-tax profit
− Tax (configurable rate, default 0 for simplicity — user can enable)
= Net Income
```

### Balance Sheet (end-of-period snapshot)

```text
Assets
  Cash & equivalents (the existing cash stock)
  Accounts receivable (revenue × DSO / 30)
  Inventory (COGS × DIO / 30)  [product businesses only]
  Prepaid expenses
  Fixed assets (net of accumulated depreciation)
= Total Assets

Liabilities
  Accounts payable (COGS × DPO / 30)
  Deferred revenue (annual/upfront billing not yet recognised)
  Debt (outstanding principal from Debt Facilities)
= Total Liabilities

Equity
  Invested capital (starting cash + any funding events)
  Retained earnings (cumulative net income)
= Total Equity

Invariant: Assets = Liabilities + Equity (engine enforces every run, every period)
```

### Cash Flow Statement (per period, indirect method)

```text
Operating Activities
  Net income
  + Depreciation (non-cash add-back)
  − Increase in accounts receivable
  − Increase in inventory
  + Increase in accounts payable
  + Increase in deferred revenue
= Cash from Operations

Investing Activities
  − Fixed asset purchases (capex)
= Cash from Investing

Financing Activities
  + Debt drawn down
  − Debt repaid
  + Equity invested (funding events)
= Cash from Financing

Net change in cash = Operating + Investing + Financing
Ending cash = Beginning cash + Net change
```

### How it connects to the engine

- The engine already tracks cash as a stock. The 3-way model DECOMPOSES that single cash number into its component flows, making visible WHY cash moved.
- Every primitive already generates the data needed — the financial statements are a structured VIEW over existing simulation outputs, not a separate model running in parallel.
- Working Capital primitives (DSO/DPO/DIO) create the timing offsets that make the cash flow statement diverge from the income statement. This is where the "profitable but broke" insight comes from.
- The balance sheet must balance (Assets = Liabilities + Equity) in every run, every period. This is an engine invariant enforced at compile time, not just a display check.

### Financials display

- "Financials" tab on the dashboard (alongside fan chart and unit economics)
- Three panels: IS, BS, CF — each showing P50 values with P10–P90 range on hover
- Time series view: any line item can be expanded into a sparkline over the horizon
- Highlight mode: click a lever change and see which financial line items moved and by how much
- Distribution view: any line item at any period shows the full MC distribution as a histogram
- Waterfall chart: visualise the bridge from revenue → net income or from net income → cash

### Complexity control

- **Simple mode** (default for most archetypes): Income statement + cash flow only. Balance sheet auto-derived but not shown unless user opens it.
- **Full mode** (user opt-in, or default for capital-intensive archetypes like manufacturing, wholesale, retail): All three statements visible.
- Tax, depreciation, and debt are off by default and toggled on per scenario. This keeps the first-time experience clean while allowing depth for users who want it.

## Events — the dice rolls

Discrete probabilistic occurrences that perturb the system:
- Sales rep hits quota (Bernoulli per rep per period)
- Big customer churns (Bernoulli weighted by customer size)
- Supply chain disruption (seasonal or Bernoulli)
- Funding round closes (scheduled)
- Competitor launches (Bernoulli with persistent effect)
- Key hire quits (Bernoulli per period per role)

Each event has a trigger (bernoulli / scheduled / conditional) and effects (adjust a stock or variable). Events are what make Monte Carlo runs diverge — without them, stochastic variables alone tend to produce boring bell curves.

## Goals & win conditions

This is the game-ification layer. A scenario has one or more **Goals**:

```
Goal = Metric + Direction + Threshold + By-when
```

Examples:
- Revenue ≥ $5M by month 24
- Cash > $0 for every month in horizon (survival goal)
- Profit margin ≥ 20% by month 18
- Market share ≥ 10% by month 36
- Customers ≥ 5,000 by month 12

**Win probability** = fraction of Monte Carlo runs that satisfy all goals. Displayed as a big gauge. The player's job is to tune levers until this number is acceptable.

Secondary display: per-goal success rate, so the user can see which goal is hardest.

## The Monte Carlo "play" experience

This is the centrepiece visual. Pressing **Run** triggers:

1. The chart canvas clears
2. 200 individual run lines animate across the chart in ~1.5 seconds (spaghetti plot)
3. They fade back to 30% opacity and the P10–P90 fan chart fades in on top
4. The P50 median line draws last, bold
5. Target threshold overlay (a green band for "goal achieved" zone) stays visible throughout
6. The win probability counter animates from 0% up to the final value
7. Failed runs (runs that missed the goal) are highlighted in a secondary colour

It should feel dramatic, like rolling dice 1,000 times at once. The animation is not decorative — it communicates uncertainty viscerally in a way a static fan chart cannot.

### Visual components on the main dashboard
- **Goal bar** (top): target + win probability gauge
- **Lever panel** (left or right): grouped sliders/inputs for key variables
- **Chart** (centre): fan chart with target zone overlay
- **Metric strip** (bottom): key derived numbers (ending revenue P50, cash trough P10, profit margin P50, etc.)
- **Event log** (collapsible): which stochastic events hit in the median run
- **Run button** (prominent): triggers the animation

### Supplementary views (tabs, not primary)
- **Distribution**: histogram of ending values
- **Sensitivity (tornado)**: which levers matter most for hitting the goal + "suggested next move" (the single lever change with highest marginal win-probability impact)
- **Unit Economics**: LTV/CAC, payback period, cohort revenue curves with MC bands — vocabulary adapts to business type
- **Financials**: three-way financial statements (IS, BS, CF) with drill-down into any line item's distribution
- **Scenario compare**: overlay base / upside / downside

## Technical architecture

### Stack — pure TypeScript, no backend

- **Framework:** Vite + React 18 + TypeScript (strict mode)
- **Styling:** Tailwind CSS + shadcn/ui
- **State:** Zustand (one store for scenario, one for results, one for UI)
- **Schema / validation:** Zod (runtime schemas that double as TS types)
- **Charts:** Visx (D3 primitives with React ergonomics) — needed for full animation control
- **Motion:** Framer Motion for UI transitions, Visx + requestAnimationFrame for chart animations
- **Workers:** Comlink over Web Workers for off-thread Monte Carlo
- **Persistence:** IndexedDB via Dexie for scenarios; `localStorage` for UI preferences
- **Testing:** Vitest (unit + engine), Playwright (smoke e2e)
- **Lint/format:** Biome (replaces ESLint + Prettier for speed)
- **Deployment:** static build on Vercel

### Why pure TypeScript (not Python + API)

1. **Slider latency is the whole game.** Every deterministic re-run must complete inside a frame budget. Local in-browser execution is the only way to guarantee that — a network round trip blows the feel budget even on localhost.
2. **Deployment simplicity.** Static site on Vercel. No API to host, no DB to manage, no CORS. Ship a URL.
3. **Workload fits.** Simple Euler integration with stochastic sampling is trivial numerically. We don't need NumPy. TypedArrays + manual vectorisation in hot loops are enough.
4. **Share-ability.** The tool is a URL. Scenarios round-trip through export/import or shareable URLs encoding the scenario as compressed JSON.

### Performance targets (hard spec)

- Deterministic single run of a 30-variable model: **< 16ms** (one frame — sliders feel live)
- 1,000-run Monte Carlo of same model: **< 3 seconds** on a typical laptop
- 10,000-run MC: **< 30 seconds**

How to hit them:
- Hot loop uses `Float64Array` with runs as an outer dimension (vectorise across runs, not across time)
- Pre-compute deterministic variable trajectories once per scenario edit
- Monte Carlo runs inside a Web Worker; UI posts the scenario, worker streams progress events back
- If a single worker isn't fast enough, spawn `navigator.hardwareConcurrency - 1` workers and shard runs across them
- Never allocate in the hot loop — reuse TypedArray buffers

### Layering

```
src/
  engine/                     # pure, framework-free, testable
    core/
      variables.ts            # evaluate variables per period, all kinds
      formulas.ts             # formula parser + topological sort for cross-primitive refs
      events.ts               # trigger + effect resolution
      constraints.ts          # cap application
      goals.ts                # win probability computation
      distributions.ts        # normal, lognormal, uniform, triangular, bernoulli
      rng.ts                  # seedable PRNG (mulberry32 or similar)
      financials.ts           # three-way financial statement derivation (IS, BS, CF)
      unit-economics.ts       # derived unit economics (LTV, CAC, payback, cohorts)
      scaling-costs.ts        # threshold-based cost triggers
      working-capital.ts      # DSO/DPO/DIO cash timing offsets
    primitives/               # Product, Channel, Store, etc. -> compile to stocks/flows
    profiler/
      profiler-config.ts      # archetype definitions, questions, industry defaults
      profiler-engine.ts      # answers → Scenario generation
      vocabulary.ts           # term mapping per archetype (drives all UI labels)
    simulate.ts               # single-run vectorised
    montecarlo.ts             # N-run MC, vectorised
    schema.ts                 # Zod schemas — one source of truth for types
    templates/                # prebuilt scenario JSONs (profiler outputs)
  workers/
    mc.worker.ts              # Comlink-exposed MC runner
  ui/
    dashboard/                # main play view
    profiler/                 # business profiler questionnaire UI
    builder/                  # model editor (primitives CRUD)
    charts/                   # fan chart, distribution, tornado (Visx)
    financials/               # three-way financial statement views
    unit-economics/           # LTV/CAC, cohort heatmap, burn metrics
    levers/                   # slider / input components
    goals/                    # goal editor + win gauge
  store/                      # Zustand stores
  lib/                        # helpers (formatting, urls, export)
  App.tsx
  main.tsx
tests/
  engine/                     # Vitest — golden numbers per template
  engine/financials/          # balance sheet invariant tests
  engine/profiler/            # archetype → scenario generation tests
  ui/                         # Playwright smoke tests
```

## Domain model (Zod + TS)

Zod schemas are the single source of truth; TypeScript types are inferred from them. This lets the engine validate user input at the boundary and the UI have full type safety with no duplication.

```ts
import { z } from "zod";

export const VariableKind = z.enum([
  "constant", "linear_trend", "exponential", "step",
  "seasonal", "stochastic", "piecewise", "elasticity",
  "formula",                                            // references other variables
]);

export const DistributionKind = z.enum([
  "normal", "lognormal", "uniform", "triangular", "bernoulli",
]);

export const Variable = z.object({
  id: z.string(),
  name: z.string(),
  kind: VariableKind,
  baseValue: z.number(),
  rate: z.number().optional(),                        // linear_trend, exponential
  changeAt: z.number().int().optional(),              // step
  newValue: z.number().optional(),                    // step
  amplitude: z.number().optional(),                   // seasonal
  period: z.number().int().optional(),                // seasonal
  distribution: DistributionKind.optional(),          // stochastic
  distributionParams: z.record(z.number()).optional(),
  series: z.array(z.number()).optional(),             // piecewise
  expression: z.string().optional(),                  // formula — e.g. "segment.customers * 0.05"
  dependencies: z.array(z.string()).optional(),       // formula — auto-extracted for topo sort
  resampleEachPeriod: z.boolean().default(true),
});
export type Variable = z.infer<typeof Variable>;

export const Constraint = z.object({
  id: z.string(),
  targetId: z.string(),
  capValue: z.union([z.number(), z.string()]),        // number or variable ref
  capKind: z.enum(["hard", "soft"]).default("hard"),
});

export const Product = z.object({
  id: z.string(),
  name: z.string(),
  price: Variable,
  unitCogs: Variable,
  elasticity: z.number().optional(),
  launchPeriod: z.number().int().default(0),
});

export const Channel = z.object({
  id: z.string(),
  name: z.string(),
  channelType: z.enum(["direct", "retail", "online", "wholesale", "partner"]),
  capacityPerPeriod: Variable,
  conversionRate: Variable,
  fixedCost: Variable,
  variableCostPct: Variable,
  rampCurve: z.array(z.number()).default([1]),
});

export const Store = z.object({
  id: z.string(),
  name: z.string(),
  count: z.number().int(),
  fixedCostPerUnit: Variable,
  revenueCapPerUnit: Variable,
  rampCurve: z.array(z.number()).default([0.25, 0.5, 0.75, 1]),
  openingSchedule: z.array(z.tuple([z.number().int(), z.number().int()])).default([]),
});

export const Segment = z.object({
  id: z.string(),
  name: z.string(),
  tam: Variable,
  ourShare: Variable,
  churnRate: Variable,
  acv: Variable,
});

export const SalesRole = z.object({
  id: z.string(),
  name: z.string(),
  count: z.number().int(),
  fullyLoadedCost: Variable,
  rampCurve: z.array(z.number()),
  quota: Variable,
  quotaHitProbability: Variable,
  attritionProbPerPeriod: Variable,
});

export const AdChannel = z.object({
  id: z.string(),
  name: z.string(),
  spend: Variable,
  cac: Variable,
  diminishingReturnsThreshold: Variable.optional(),
});

export const PaymentTerms = z.object({
  dso: z.number().default(0),                          // days sales outstanding
  dpo: z.number().default(0),                          // days payable outstanding
  dio: z.number().default(0),                          // days inventory outstanding
  billingFrequency: z.enum(["monthly", "quarterly", "annual", "upfront"]).default("monthly"),
});

export const ScalingCostTrigger = z.object({
  id: z.string(),
  name: z.string(),
  triggerMetric: z.string(),                           // "customers" | "headcount" | "revenue" | "orders"
  threshold: z.number(),
  costType: z.enum(["one_time", "recurring"]),
  amount: Variable,
});

export const FixedAsset = z.object({
  id: z.string(),
  name: z.string(),
  purchaseCost: Variable,
  usefulLifeMonths: z.number().int(),
  depreciationMethod: z.enum(["straight_line"]).default("straight_line"),
  purchaseSchedule: z.array(z.tuple([z.number().int(), z.number().int()])).default([]),
});

export const DebtFacility = z.object({
  id: z.string(),
  name: z.string(),
  principal: z.number(),
  interestRate: z.number(),                            // annual rate
  termMonths: z.number().int(),
  drawdownSchedule: z.array(z.tuple([z.number().int(), z.number()])).default([]),
  isRevolving: z.boolean().default(false),
  revolvingLimit: z.number().optional(),
});

export const BusinessProfile = z.object({
  archetype: z.enum([
    "saas", "restaurant", "retail", "ecommerce",
    "wholesale", "services", "marketplace", "manufacturing",
  ]),
  stage: z.enum(["idea", "pre_revenue", "early", "growth", "mature"]),
  answers: z.record(z.union([z.string(), z.number(), z.boolean()])),
});

export const Goal = z.object({
  id: z.string(),
  metric: z.string(),                                  // "revenue" | "cash" | "profitMargin" | "customers" | ...
  direction: z.enum(["at_least", "at_most", "between"]),
  threshold: z.number(),
  upperThreshold: z.number().optional(),
  byPeriod: z.number().int(),
  allPeriods: z.boolean().default(false),
});

export const Scenario = z.object({
  id: z.string(),
  name: z.string(),
  horizonPeriods: z.number().int().default(36),
  timeStep: z.enum(["month", "quarter"]).default("month"),
  currency: z.string().default("AUD"),
  products: z.array(Product),
  channels: z.array(Channel),
  stores: z.array(Store).default([]),
  segments: z.array(Segment).default([]),
  salesRoles: z.array(SalesRole).default([]),
  adChannels: z.array(AdChannel).default([]),
  otherHeadcount: z.array(HeadcountRole).default([]),
  events: z.array(Event).default([]),
  constraints: z.array(Constraint).default([]),
  goals: z.array(Goal),
  startingCash: z.number(),
  // New: working capital, scaling, assets, debt, profiler
  paymentTerms: PaymentTerms.default({}),
  scalingCosts: z.array(ScalingCostTrigger).default([]),
  fixedAssets: z.array(FixedAsset).default([]),
  debtFacilities: z.array(DebtFacility).default([]),
  businessProfile: BusinessProfile.optional(),          // set by profiler, drives vocabulary + UI
  taxRate: z.number().default(0),                       // 0 = off; user can enable
});

export const MonteCarloResult = z.object({
  scenarioId: z.string(),
  nRuns: z.number().int(),
  // metric -> percentile (5,10,25,50,75,90,95) -> series
  percentiles: z.record(z.record(z.array(z.number()))),
  winProbability: z.number(),
  perGoalSuccess: z.record(z.number()),
  bindingConstraints: z.record(z.number()),
  // New: three-way financials + unit economics as MC distributions
  financialStatements: z.object({
    incomeStatement: z.record(z.record(z.array(z.number()))),    // lineItem -> percentile -> series
    balanceSheet: z.record(z.record(z.array(z.number()))),
    cashFlowStatement: z.record(z.record(z.array(z.number()))),
  }),
  unitEconomics: z.record(z.record(z.array(z.number()))),       // metric -> percentile -> series
});
```

## Engine sketch

```ts
// simulate a single run, mutating preallocated TypedArray buffers
export function simulateRun(
  scenario: CompiledScenario,
  buffers: RunBuffers,
  rng: RNG
): void {
  const T = scenario.horizonPeriods;
  for (let t = 0; t < T; t++) {
    resolveVariables(scenario, t, buffers, rng);       // pass 1: non-formula variables
    resolveFormulas(scenario, t, buffers);              // pass 2: formula vars (topo-sorted)
    applyEvents(scenario, t, buffers, rng);
    applyScalingCosts(scenario, t, buffers);            // check threshold triggers
    computeFlows(scenario, t, buffers);
    updateHeadcount(scenario, t, buffers, rng);
    integrateStocks(scenario, t, buffers);
    deriveFinancials(scenario, t, buffers);             // IS, BS, CF from flows + stocks
    applyWorkingCapitalTiming(scenario, t, buffers);    // DSO/DPO/DIO cash offsets
    recordSnapshot(scenario, t, buffers);
  }
  assertBalanceSheetBalances(scenario, buffers);        // invariant check
}

// Monte Carlo: runs stacked as rows; evaluate goals at the end
export function monteCarlo(
  scenario: CompiledScenario,
  nRuns: number,
  baseSeed: number,
  onProgress?: (done: number) => void
): MonteCarloResult {
  const buffers = allocateBuffers(scenario, nRuns);
  for (let i = 0; i < nRuns; i++) {
    const rng = makeRng(baseSeed + i);
    simulateRun(scenario, sliceBuffers(buffers, i), rng);
    if (onProgress && i % 50 === 0) onProgress(i);
  }
  return aggregate(scenario, buffers);
}
```

The worker wraps `monteCarlo` with Comlink and streams progress back to the UI so the chart animation can start drawing runs as soon as they complete.

## Business Profiler — guided scenario generation

The profiler is the primary entry point for new users. Instead of choosing a generic template and hoping it fits, users answer 5–10 guided questions and get a scenario built for their specific business type, stage, and economics.

### How it works

1. User selects a **business archetype** (or "I'm not sure" → the profiler asks extra classifying questions)
2. Profiler asks **3–8 follow-up questions** specific to that archetype
3. System generates a complete Scenario with:
   - Appropriate primitives (a restaurant gets Stores + Headcount, not SalesRoles; SaaS gets Cohorts + AdChannels, not Stores)
   - Industry-benchmark defaults (food cost ~30%, SaaS monthly churn ~5%, retail shrinkage ~1.5%)
   - Relevant constraints (hours of operation, seating capacity, TAM, warehouse capacity)
   - Sensible goals (break-even by month X, revenue target, cash survival)
   - Pre-wired feedback loops typical for the business type
   - Correct financial statement structure (capital-intensive businesses get full 3-way; SaaS gets IS + CF by default)
4. User lands on the dashboard with everything pre-populated and editable

### Business archetypes

| Archetype | Key primitives | Key metrics | Unique constraints |
| --- | --- | --- | --- |
| **SaaS / Subscription** | Product, Segment (cohorts), AdChannel, SalesRole | MRR, ARR, churn, LTV/CAC, NRR, burn multiple | — |
| **Restaurant / Hospitality** | Store (locations), Product (menu items), Headcount | Covers/day, avg check, food cost %, table turnover, RevPASH | Hours of operation, seating capacity, perishable waste % |
| **Retail (physical)** | Store, Product (SKUs), Channel (foot traffic + online) | Revenue/sqft, inventory turns, shrinkage %, conversion rate | Store capacity, seasonal demand, inventory spoilage |
| **E-commerce / DTC** | Product, AdChannel, Channel (online), Segment | AOV, CAC, return rate, repeat purchase rate | Shipping cost, warehouse capacity, seasonal peaks |
| **Wholesale / Trading** | Product (grades), Channel (bulk/auction/retail), Working Capital | Margin/unit, inventory days, cash conversion cycle | Payment terms, storage capacity, minimum order quantities |
| **Services / Consultancy** | Headcount (billable), Segment (clients), SalesRole | Utilisation %, effective rate, revenue/consultant | Bench cost, project pipeline, capacity = headcount |
| **Marketplace** | Segment (supply + demand), Channel, AdChannel | GMV, take rate, liquidity score, CAC (both sides) | Supply/demand balance, network effects |
| **Manufacturing** | Product, Store (facilities), Headcount, Fixed Assets | Units/hour, yield %, capacity utilisation, cost/unit | Machine capacity, shift patterns, raw material lead times |

### Profiler questions (example: Restaurant)

1. How many locations do you have (or plan to open)?
2. What's your average cover price ($ per guest)?
3. How many seats per location?
4. How many seatings/turns per service?
5. What are your operating hours? (lunch + dinner, dinner only, all day)
6. What's your target food cost %? (default 30%)
7. Do you have a liquor licence? (significantly changes margin profile)
8. Are you planning to open new locations? (triggers store expansion model with ramp curves + capex)

### Profiler questions (example: SaaS)

1. What's your monthly subscription price?
2. How many customers do you have today? (0 = pre-launch)
3. What's your current monthly churn rate? (default 5% if unsure)
4. How are you acquiring customers? (sales team / paid ads / organic / mix)
5. What's your current CAC? (or "I don't know" → derive from ad spend + sales cost)
6. How many employees? (split: engineering, sales, other)
7. Do you have funding runway or are you bootstrapped?

### Vocabulary mapping

The profiler maps generic engine terms to business-specific language. This mapping drives all UI labels, tooltips, and metric names throughout the app:

- `Segment.churnRate` → SaaS: "Monthly churn rate" | Restaurant: n/a (hidden) | Retail: "Customer lapse rate"
- `Store.revenueCapPerUnit` → SaaS: n/a | Restaurant: "Revenue per seat-hour (RevPASH)" | Retail: "Revenue per sqft"
- `Product.unitCogs` → SaaS: "Infrastructure cost per user" | Restaurant: "Food cost per cover" | Retail: "Cost of goods"
- `Channel.conversionRate` → SaaS: "Trial-to-paid conversion" | Restaurant: n/a | E-commerce: "Site visitor conversion rate"
- `Headcount.count` → Services: "Billable consultants" | Manufacturing: "Line operators" | SaaS: "Engineers"

### Relationship to templates

Templates still exist as pre-built scenarios, but they are now:

1. **Outputs of the profiler** with hardcoded question answers (for the "skip profiler" flow)
2. Starting points that users can regenerate by re-running the profiler with different answers
3. Showcase scenarios for the "just let me play" user who wants to explore immediately

## Templates to ship with v1

Each template is a profiler-generated scenario with sensible defaults. They serve as both quick-start options and reference implementations of each archetype.

1. **SaaS startup** — one product, one direct sales channel, 3 reps, ad spend, segment with churn. Goal: $5M ARR by month 24, cash > 0 always.
2. **Restaurant (single location)** — one store, menu product, kitchen + service headcount, seating capacity constraint, perishable waste. Goal: break-even by month 12, food cost < 32%.
3. **Retail chain** — one product, multi-store with revenue caps and opening schedule, market size constraint, inventory turns. Goal: profitability by month 18.
4. **E-commerce / DTC** — product catalogue, paid ads + organic channels, return rate, seasonal demand. Goal: positive contribution margin by month 12, LTV/CAC > 3.
5. **Wholesale trading** — inventory by grade, auction win rate, channel mix (bulk / ecommerce / retail partners), working capital cycle, warehouse capacity constraint. Goal: positive cash cycle, grow gross profit $ 25% YoY.
6. **Services consultancy** — billable headcount with utilisation, pipeline, staged hiring plan. Goal: utilisation > 75%, hit revenue target.
7. **Marketplace** — supply stock, demand flow, take rate, reinforcing liquidity loop. Goal: GMV > $X, take rate stable.
8. **Manufacturing** — production facility, raw materials, machine capacity, shift scheduling, fixed assets with depreciation. Goal: unit cost < $X, capacity utilisation > 80%.

## Development phases

**Phase 1 — Engine + minimum UI (12 days)**

Build in parallel. Engine and UI land together so there's always something playable.

*Engine:*
- Zod schema for Scenario + all primitives (including new: PaymentTerms, ScalingCostTrigger, FixedAsset, DebtFacility, BusinessProfile)
- Variable resolver (all kinds including formula with topological sort)
- Event + constraint resolution
- Single-run `simulateRun` with TypedArray buffers
- Monte Carlo wrapper, in-thread initially
- Goal evaluation + win probability
- Simplified financial statement derivation (income statement + cash flow — no balance sheet yet)
- Vitest golden-numbers tests against one template

*UI:*
- Vite + React + Tailwind + shadcn/ui bootstrapped
- Dashboard skeleton: goal bar, lever panel, chart area, metric strip, Run button
- Static fan chart in Visx (no animation yet) fed from a hardcoded template
- Two or three levers wired to the store, triggering a deterministic re-run on change
- Win probability gauge

Acceptance: one template loads, one lever moves it, Run produces a fan chart with income statement visible.

**Phase 2 — Web worker + animated MC reveal (7 days)**

- Move MC into a worker via Comlink
- Animate the Monte Carlo reveal (spaghetti → fan → median, with win probability counter)
- Event log panel
- Performance work to hit the three targets

Acceptance: pressing Run is dramatic, 1,000-run MC lands in under 3 seconds, UI stays smooth.

**Phase 3 — Full primitives + financial model (12 days)**

- Add Store, SalesRole (ramp + quota), AdChannel (diminishing returns), full Headcount
- Scaling cost triggers
- Fixed assets + depreciation
- Debt facilities + interest
- Full three-way financial statements (add balance sheet with invariant enforcement)
- Working capital timing (DSO/DPO/DIO offsets)
- Unit economics computation engine
- Model builder UI (CRUD over primitives)
- Constraints wiring + "binding" UI indicators
- Sensitivity (tornado) analysis + "suggested next move" feature
- Financial statements tab UI
- Unit economics tab UI

Acceptance: all primitives usable; user can build a scenario from scratch; balance sheet balances; "profitable but broke" scenario is demonstrable.

**Phase 4 — Business Profiler + templates (10 days)**

- Profiler questionnaire UI (archetype selection + follow-up questions)
- Archetype definitions for all 8 business types
- Vocabulary mapping system (generic engine terms → business-specific labels)
- Question → Scenario generation engine (profiler-engine.ts)
- Feedback loop auto-wiring per archetype
- All 8 templates shipped (as profiler-generated outputs)
- Industry-benchmark defaults per archetype

Acceptance: a new user answers 5 questions and lands on a fully populated, playable dashboard with business-appropriate vocabulary.

**Phase 5 — Persistence + sharing (5 days)**

- IndexedDB-backed scenario library (Dexie)
- Scenario import/export (JSON)
- Shareable URL encoding scenario as compressed base64
- Scenario comparison view

Acceptance: can save, load, share, and compare scenarios.

**Phase 6 — Polish**

- Profiler-aware onboarding tour
- Empty states and friendly errors
- Keyboard shortcuts
- Deploy to Vercel
- Export chart as PNG, results as CSV, financials as Excel

## Non-goals (v1)

- Not a full accrual accounting system — no journal entries, no GL codes, no multi-entity consolidation
- Financial statements are auto-derived from the simulation, not manually constructed — this is a modelling tool, not a bookkeeping tool
- Not a forecasting tool that claims accuracy — explicitly framed as exploration
- Not multi-user or collaborative in v1
- Not mobile-first (desktop dashboard first, responsive tablet later)
- Not a full system dynamics package — no continuous-time ODE, no arrays
- No backend, no auth, no server-side persistence in v1

## Conventions

- TypeScript strict mode; no `any` without a justification comment
- Zod schemas at every external boundary (file import, URL decode, user form submit)
- Types always inferred from Zod: `type Foo = z.infer<typeof Foo>`
- Biome for lint + format; clean on commit
- Engine code is framework-free and pure — no React, no browser APIs
- RNG seeded per MC batch; default seed 42 in dev for reproducibility
- All monetary values in `scenario.currency` (default AUD)
- One scenario = one JSON object, compressible for URL sharing
- shadcn/ui components only; no other component libraries

## Success criteria

Ship is defined by four tests:

1. **The 60-second test:** a new user answers the profiler, reads the goal, adjusts two levers, presses Run, and understands the fan chart — all within 60 seconds of opening the app.
2. **The "one more tweak" test:** a user adjusts a lever, presses Run, and then wants to adjust another lever. Repeatedly. Without prompting.
3. **The insight test:** a user says "oh, so *that's* what's actually driving this" about something they didn't know before they played.
4. **The "aha, that's why I'm out of cash" test:** a user sees their income statement shows profit but their cash flow statement shows negative operating CF, and understands it's because of payment terms / inventory growth / scaling costs. The three-way model reveals something the P&L alone hides.

If any of these fail, the app isn't done regardless of feature completeness.

## Open questions

- **Fan chart rendering.** Visx should work for ≤1,000 run spaghetti plots. For 10,000, may need to drop to a `<canvas>` with manual draw calls instead of SVG. Decide during Phase 2.
- **Scenario sharing.** URL-encoded JSON is elegant but breaks at ~2KB on some browsers. If scenarios outgrow that, add an optional "save to server" mode (Supabase, blob storage) behind an explicit user action — but keep local-first as the default.
- **Custom primitives.** v1: user can only configure the built-in ones. Later: let users define a primitive as a named bundle of stocks/flows/variables.
- **Goal scoring.** Default strict (all goals must pass for a run to "win"), with per-goal breakdown displayed. Reconsider if users ask for weighted scoring.
- **Price elasticity.** First-class in Product for v1; more complex demand curves (log-linear, constant-elasticity) for v2.
- **Profiler depth vs speed.** The profiler should be fast (< 60 seconds to complete) but accurate enough to generate a useful starting model. If users skip questions, defaults must still produce a playable scenario. Test with real users to find the right number of questions per archetype.
- **Financial statement complexity.** Default to IS + CF only; balance sheet on opt-in. If user testing shows the balance sheet confuses more than it helps for non-finance users, keep it hidden behind an "advanced" toggle permanently.
- **Formula variable performance.** Topological sort per timestep adds overhead. For typical models (< 50 formula variables), this should be negligible. Profile during Phase 1 to confirm and set a hard cap if needed.
