# Dashboard (page-dashboard) — Implementation Spec for React Native

Reverse-engineered from the web client:
- `v4-client/shared/dashboard.html` (markup)
- `v4-client/js/app.js` (logic; dashboard code = `initDashboard()` at line 6066; shared helpers elsewhere)
- `v4-client/js/data-shared.js` (`window.WS='shared'`, `window.WS_DATA.socialMentions`)

> This is the **SharedView / social** workspace (`window.WS==='shared'`, `WS_DATA.socialMentions` present). The same `initDashboard()` also drives a MediaWatch (news) and an AdWatch workspace; those branches are noted where they change behaviour, but the mobile target is the **social** path. Everything below is mock/hardcoded data — there is no live API. The re-implementation only needs to reproduce the shapes, formulas and visual encodings.

All charts are **Recharts 2.12.7** mounted into `<div class="db-chart-wrap">` hosts via `dbMount(id, reactElement)`. `RC = React.createElement`. Dark tooltip background is `#181d26` everywhere.

---

## 0. Global conventions

### Chart host → React Native mapping
Each chart is a fixed-height box (`height:` inline on the host div). For RN use `react-native-svg` + `victory-native`/`react-native-gifted-charts` or hand-drawn SVG. Heights (px): Timeline 420, Exposure 110, Tonality donut/bar 280 each, Frequency 360, Top Media Sources 440, Influencer bubble 440 / bar 380, Media Source Distribution 380, treemap auto.

### Word helpers (affect every label)
- `_SOC()` → true in SharedView. `_wPost(cap)` → `'post'/'Post'`; `_wPosts(cap)` → `'posts'/'Posts'`. (MediaWatch = "article(s)", AdWatch = "ad(s)".)

### Platform filter (`_dashPlats`)
A multi-select in the filter bar (`#db-plat-menu`, built by `dashPlatRender`). Options: Facebook, X (Twitter), Instagram, YouTube, Reddit, TikTok. "Select All"/none ⇒ empty set ⇒ **All (aggregate)**. `dashPlatApply()` writes `_dashPlats` and re-calls `initDashboard()` (full re-render). Label: 0→"All platforms", 1→that platform's label, N→"N platforms". Many charts filter/recompute from `_dashPlats` (noted per chart).

### Number formatting
- Percentages: `.toFixed(2)` for legends (e.g. `81.16%`), `Math.round` or `.toFixed(0)` in prose.
- Story value / scores: `.toFixed(2)`.
- Big numbers in mock data are pre-formatted strings (`'4.2K'`, `'62.0M'`, `'PHP 397.9K'`).

---

## 1. The 10 KPI cards

Grid `.db-kpi-grid`, 3 rows (4 + 4 + 2). Each card: `.db-kpi-label`, `.db-kpi-val` (optionally with `.db-kpi-avatar` + `.db-kpi-name` + `.db-kpi-detail`), divider, `.db-kpi-delta` (`db-kpi-up` green / `db-kpi-down` red) with `▲`/`▼`.

**All values and % deltas are hardcoded in the HTML.** Only two cards are recomputed by JS, and only when a platform filter is active (block at app.js 8825–8843):

| # | Card | Value | Detail | Δ | Avatar letter / bg | onClick |
|---|------|-------|--------|---|--------------------|---------|
|1|Total Results|`69`|—|−24% ▼|—|`openTotalPostsExplore()`|
|2|Top Influencer|`jmccautosupply`|56 posts|−2% ▼|`J` / `#7c3aed`|`openTopInfExplore()`|
|3|Most Engaging Posts|`BNSATOfficial`|7.2K posts|100% ▲|`B` / `#7c3aed`|`openMostEngagingExplore()`|
|4|Top Entities|`DITO Telecommunity`|24 posts|8% ▲|`D` / `#7c3aed`|— (not clickable)|
|5|Most Dominant - Instagram|`ditophofficial`|1 posts|−90% ▼|`D` / `#e4405f`|`openDomExplore('instagram')`|
|6|Most Dominant - Facebook|`jmccautosupply`|56 posts|−2% ▼|`J` / `#1877f2`|`openDomExplore('facebook')`|
|7|Most Dominant - Twitter|`bilyonaryo_ph`|12 posts|−50% ▼|`B` / `#000000`|`openDomExplore('twitter')`|
|8|Most Dominant - Youtube|`DITOTelecomPH`|9 posts|−12% ▼|`D` / `#ff0000`|`openDomExplore('youtube')`|
|9|Most Dominant - Tiktok|`dito.ph`|6 posts|5% ▲|`D` / `#111111`|`openDomExplore('tiktok')`|
|10|Most Dominant - Reddit|`r/Philippines`|4 posts|−3% ▼|`P` / `#ff4500`|`openDomExplore('reddit')`|

**Avatar letter** = first character of the name, uppercased (`name.charAt(0).toUpperCase()`; the filtered recompute strips non-alphanumerics first). **Avatar bg color** = the platform's brand color (`SOCIAL_PLATFORMS[plat].color`); the first three non-platform cards use purple `#7c3aed`.

**% delta** is a static mock in every case — there is no previous-period computation. Treat it as a per-card data field.

**Filter behaviour** (data-driven):
- **Total Results** = Σ `count` over selected platforms from `_EXP_PLAT_ALL` (facebook 67, twitter 14, instagram 12, youtube 9, reddit 6, tiktok 5). No filter ⇒ `69`.
- **Top Influencer** = across selected platforms, the account with the max `DOM_DATA[p].inf[0].posts`; avatar bg becomes that platform's color.
- The 6 **Most Dominant** cards (`data-plat`) are shown/hidden: visible iff no filter or platform is selected. A small platform icon (`socIcon`) is injected before the label.

---

## 2. Timeline chart (`#db-timeline`, ComposedChart)

### Data (`TL_FULL`, 30 days ending **Jun 23, 2026**)
For `i = 29…0` (day = end − i):
```
results = i<=8 ? tail[8-i] : 30 + ((i*37) % 70)
tail = {0:15,1:56,2:150,3:70,4:65,5:12,6:45,7:78,8:5}   // last 9 days (the "screenshot" tail)
storyValue = 0 ; projAvg = 0 ; band = [-12, +12]          // constant → flat line + flat band
date     = "D. Mon"      (e.g. "23. Jun")
fullDate = "Mon D, YYYY" (e.g. "Jun 23, 2026")
```
`buildTimeline(rangeDays)` renders `TL_FULL.slice(-rangeDays)`.

### Range toggles (`.db-tl-range`, `setTimelineRange(n)`)
`3D`(3) · **`7D`(7, default)** · `15D`(15) · `1M`(30). Toggling re-renders; if an open Insights detail day falls out of range it reverts to overview.

### Axes & scales
- X: `dataKey:'date'`, `scale:'point'`, padding 40/40, tick 11px `#6b7280`.
- Two hidden Y axes: `yAxisId:'v'` domain **[−110, 90]**; `yAxisId:'r'` domain **[0, ceil(maxR*2.6)]** where `maxR = max(results, 10)`. The `*2.6` keeps bars in the lower ~38% so the (upper) story-value band/line has room.
- `Customized` draws rotated axis titles: **"Total Story Value"** at height-fraction 0.42, **"Total Results"** at 0.80; numeric ticks `0` @0.45, `100` @`1−100/rMax`, `0` @0.985.

### Series (draw order)
1. Zebra `ReferenceArea` stripes every other day (`rgba(24,29,38,0.04)`).
2. `CartesianGrid` horizontal only, `#f0f1f3`.
3. **Area `band`** ("Bollinger Bands") on `v`: fill `#b9a4f7` opacity **0.22**, no stroke.
4. **Bar `results`** ("Total Results Bar") on `r`: fill **`#16a34a`**, maxBarSize 42, radius `[3,3,0,0]`. Click → `openTimelineDay(fullDate)`. Selected day keeps opacity 1, all others dim to **0.3** (`tlSelectedDate`).
5. **Line `projAvg`** ("Projected Average"): `#9ca3af`, width 1.5, dash `4 3`, no dots.
6. **Line `storyValue`** ("Total Story Value"): `#b9a4f7`, width 1.75, dots r3 white-stroked, activeDot r5.
7. **Brush** (height 36, traveller 8, stroke `#d4d4d8`) wrapping a mini green area (stroke `#16a34a`, fill `#86d9a8` @0.55).

Legend bottom, iconSize 10: Bollinger Bands / Total Results Bar / Projected Average / Total Story Value.

### Tooltip (`TLTooltip`)
Header = `fullDate`. Rows (dot color, label, value): Total Story Value `#b9a4f7`, Projected 7 days Average `#9ca3af`, Max 7 days Forecast `#b9a4f7` (`band[1]`), Min 7 days Forecast `#cfc3f3` (`band[0]`), divider, Total Results `#16a34a`.

### Interactions
- **Explore Data** → `openTotalPostsExplore()` (§10.1).
- **Insights** → `openTimelineInsights()` opens the right slide-over (`#ti-overlay`). Overview = AI-style narrative computed from the current range (`tiAnalysis()`): total, daily avg, peak/trough day, trend % (`(last−first)/first`), momentum (recent third vs prior third), biggest day-over-day spike & drop, top-3 days, top sources. Clicking a bar or a rank row → `openTimelineDay(fullDate)` which shows that day's posts table (`renderInsTable`). `dayArticles(day)` seeds a per-day list sized `clamp(round(results/14),3,8)`.

---

## 3. Platform Exposure (`#db-exposure`, 100% stacked horizontal bar)

### Data
- **No filter (default social):** one row `{facebook:81.16, twitter:17.39, instagram:1.45}`; series = 3 platforms with colors **facebook `#3b7dd8`, twitter `#29a3f0`, instagram `#d6249f`** (note: only 3 shown by default).
- **Filter active:** series = selected platforms from `_EXP_PLAT_ALL` (colors facebook `#3b7dd8`, twitter `#29a3f0`, instagram `#d6249f`, youtube `#ef4444`, reddit `#f97316`, tiktok `#8b5cf6`); row values = each platform's `count` ÷ selected total × 100 (`.toFixed(2)`).

### Encoding
Vertical-layout `BarChart`, X number domain [0,100] hidden, Y category hidden, maxBarSize 50. First segment radius `[5,0,0,5]`, last `[0,5,5,0]`. In-segment `LabelList`: show `"${LABEL}: ${v}%"` only when `v>=10`, else blank, white text. Hover or locked-open segment dims the others to **0.3**.

### Interactions
Click a segment → Insights panel with that platform's posts (`socialMentions` filtered by platform). Card **Insights** (`openExposureInsights`) = `expAnalysis()`: rows sorted by pct desc; top channel, top-3 concentration, active channels, long-tail, `top.pct/second.pct` multiplier. `EXP_TOTAL=304` used to derive notional counts.

---

## 4. Channel summary cards (`#db-channels`, `.db-ch-grid.soc-ch-grid`)

SharedView uses `socialChannelData` (one card per platform, filtered by `_dashPlats`). Grid is 3-col. Each card: header (platform label + tinted brand icon `${color}1a` bg), a `.soc-ch-stats` list of `[label,value]` pairs, optional **Reactions** row (Facebook only) and optional **Breakdown** notes (icon chosen by keyword).

```
facebook : Avg. Inf. Score 0.01 · Total Story Value 0.04 · Video Posts 56 · Total Posts 56 · Total Likes 397 · Comments 188
           reactions 👍397 😮25 ❤️319 😢2 😆32 😠14
twitter  : Avg. Inf. Score 0 · Total Likes 8 · Total Story Value 0 · Retweets 0 · Total Tweets 12
           notes "1 tweet: 8 likes", "1 tweet: 0 retweets"
instagram: Avg. Inf. Score 0 · Total Likes 9 · Total Story Value 0 · Total Posts 1 · Comments 2
           notes "1 video: 9 likes","1 video: 0 views","1 video: 2 comments"
youtube  : Avg. Inf. Score 0.02 · Total Story Value 0.03 · Video Posts 14 · Total Views 4.2K · Total Likes 210 · Comments 45
           notes "1 video: 210 likes","1 video: 4.2K views","1 video: 45 comments"
reddit   : Avg. Inf. Score 0.01 · Total Story Value 0.01 · Total Posts 8 · Upvotes 96 · Comments 63 · Awards 3
           notes "1 post: 96 upvotes","1 post: 63 comments"
tiktok   : Avg. Inf. Score 0.03 · Total Story Value 0.05 · Video Posts 5 · Total Likes 340 · Comments 78 · Shares 21
           notes "1 video: 340 likes","1 video: 78 comments"
```
(MediaWatch instead renders `channelData`: media-type cards with a Total AVE hero + Articles/Pub.Score/Avg Words/Story Value.) `.db-ch-sub-val.zero` greys a `'0'` value. Note icons: retweet→repeat, views→eye, comments→message-circle, upvotes→arrow-big-up, shares→share-2, awards→award, likes→heart, else bar-chart-2.

---

## 5. Tonality Distribution (`#db-tonality-donut` + `#db-tonality-bar`)

Colors `tonColors = {Positive:'#16a34a', Neutral:'#9ca3af', Negative:'#dc2626'}`.

### Donut (`TonDonut`)
`tonPie = [Positive 8, Neutral 3, Negative 2]` (grand total 13). `innerRadius 55%`, `outerRadius 82%`, `paddingAngle 1`, no stroke. Hover: active slice grows `outerRadius+5` (`TonActiveShape`) and others fade to **0.35**. Click a slice → posts filtered by tone (`_insByTone`).

**Legend** (`#db-ton-legend`, above the charts): each item = colored dot + name + muted `(value/13*100).toFixed(2)% (count)` → `Positive 61.54% (8)`, `Neutral 23.08% (3)`, `Negative 15.38% (2)`.

### Stacked time-bar (`TonBar`)
`tonDates`:
```
Jun 16,2026  P1 N1 Ng0
Jun 19,2026  P1 N0 Ng1
Jun 21,2026  P2 N1 Ng1
Jun 22,2026  P4 N1 Ng0
```
Vertical stacked bars, stack order Positive→Neutral→Negative, maxBarSize 48, **top corners rounded only on the topmost non-zero segment** of each stack. Hover a date dims other dates to 0.3. Y integer only, width 28. Tooltip lists all three tones for the hovered date.

### Interactions
Card **Explore Data** → `openTonalityExplore()` (§10.5). **Insights** (`openTonalityInsights`, `SRC.tonality`) computes net sentiment `(pos−neg)/total`, dominant tone, pos:neg ratio, peak positive day, net-negative-day count, etc.

---

## 6. Frequency Distribution (`#db-frequency`, histogram + brush)

### Data (`freqDistData`)
Buckets are **integer story-value values 0…10** (x label rendered `v.toFixed(2)` → "0.00".."10.00"). Count per bucket:
- **No filter:** default `freqCounts = {0:3, 1:2, 4:3}` (all other buckets 0).
- **Filter active:** sum `_PLAT_FREQ[p]` over selected platforms:
```
facebook {0:90}
instagram{1:2,2:2,3:1,7:1}
twitter  {1:8,2:1,3:1}
youtube  {1:1,2:1,3:1,4:1,5:1,9:1}
reddit   {1:1,2:2,3:1,4:1}
tiktok   {1:1,2:1,3:1,6:1}
```
Each post is counted into the bucket equal to its (floored) story value; the histogram is **count of posts per story-value bucket**.

### Encoding
Vertical bars, X = "Story Value", Y = "`{Post} Count`". maxBarSize 24, radius `[3,3,0,0]`. Focus-and-dim: hovered bar `#b9a4f7`, all others `#e8e1fb` (when nothing hovered, all `#b9a4f7`). `LabelList` count on top. Brush at bottom (stroke `#b9a4f7`, area fill `#ece6fb`). Tooltip row: "`{Post} Count`" = value, dot `#b9a4f7`. Click a bar → Insights posts seeded by `'freq-'+value`.

---

## 7. Top Media Sources + Influencer Story Value Distribution (paired row `.db-row-5-5`)

### 7a. Top Media Sources (`#db-mediasources`) — **time swimlane scatter, NOT a bubble-size chart**
`TMS_SRC` (filtered by `_dashPlats`):
```
Facebook  #1877f2  count 67
Twitter   #f97316  count 14
YouTube   #ef4444  count 14
Reddit    #ff4500  count 8
Instagram #16a34a  count 1
```
- Y = platform **category** (reversed, tick shows `Name (count)` in platform color + grey count), width 96.
- X = time, domain **Jul 1–8 2026**, ticks per day, `orientation:'top'`, formatted `"DOW DD"` (e.g. "Wed 02").
- For each platform, `count` dots are scattered: day/hour/minute and a y-jitter derived from a hash `h=((pi+1)*2654435761 + i*40503)>>>0` (`day=1+h%7`, `jit=((h>>>15)%13)-6`, influencer = `TMS_INFL[(h>>>3)%6]`). Dot r5, fillOpacity 0.7.
- Tooltip: platform name, Influencer, Posted date. Footer shows the date span. Click → Insights with all `socialMentions`.

### 7b. Influencer Story Value Distribution (`#db-influencer-bubble` / `#db-influencer-bar`, tabs)
`influencerData` (default 11; **if filter: `flatMap(DOM_DATA[p].bubble)`**):
```
{name, posts, sv(storyValue), score(influencerScore), color}
jmccautosupply 9 3.2 0.02 #2563eb | DITOphofficial 1 10.0 10.0 #0f172a | dylanburton02 3 2.6 0.80 #7c3aed
pldt 5 14.6 6.20 #e94f37 | bilyonaryo_ph 4 3.0 1.20 #16a34a | BilyonaryoPh 3 18.2 8.40 #0891b2
ConvergeICT 2 2.4 0.60 #d97706 | negosyantenews 8 14.5 5.80 #6b7280 | SHAYLIBAND5 6 7.3 3.10 #db2777
contextdotph 2 0.5 0.10 #64748b | ANCalerts 1 4.0 1.00 #f59e0b
```

**Bubble tab** (default, `setInfluencerTab('bubble')`): ScatterChart.
- X = **Post Count**, domain `[0, max(posts)+1]`.
- Y = **Story Value**, domain `[0, 20]`.
- **Bubble radius = `6 + score*1.4`** (influencer score drives size), color per-influencer, opacity 0.72.
- Legend below lists every influencer (dot+name). A **brush** underneath (sorted ascending by posts) filters which dots show (`startIndex/endIndex` state).
- Tooltip: name, Post Count, Total Story Value (`sv.toFixed(2)`), Influencer Score (`score.toFixed(2)`).

**Bar tab** (`setInfluencerTab('bar')`): horizontal bars, `inflDesc` (sorted desc by posts), X = Post Count, Y = name (left-anchored tick), per-bar color, LabelList posts at right, maxBarSize 26. Tooltip: "Post Count".

Click any mark → Insights with `socialMentions`. Card **Insights** (`SRC.influencer`) = top by sv, most prolific, most efficient (`sv/posts`), averages.

---

## 8. Media Source Distribution (`#db-mediasource`, scatter)

`mediaSourceData` (filtered by `_dashPlats`):
```
Facebook  #1877f2  postCount 67  storyValue 0.42
Twitter   #16a34a  postCount 14  storyValue 0.11
Instagram #1e293b  postCount 12  storyValue 0.18
YouTube   #ef4444  postCount 9   storyValue 0.36
Reddit    #f97316  postCount 6   storyValue 0.09
TikTok    #8b5cf6  postCount 5   storyValue 0.29
```
- X = **Post Count**, domain `[0, 'dataMax']`.
- Y = **Story Value**, auto domain.
- Dots fixed radius **7**, white stroke 1.5, color per-platform.
- Legend centered below (dot+name). Brush on X. Tooltip: name, Post Count, Story Value.
- Click → Insights with `socialMentions`.

---

## 9. Entities Map (`#db-entities`, flexbox treemap)

`entityData` (dashboard, 4 types):
```
ORG    48.18%  #8d7ba8  "Organization Entities: …business, society, association…"
PERSON 40.00%  #6b7fb0  "Person Entities: Names of people, including fictional characters."
GPE     9.09%  #6bb0bd  "Geopolitical Entities: Countries, cities, or states."
NORP    2.73%  #5fb088  "Nationalities or religious / political groups."
```
### Layout (CSS flex, not Recharts)
Two columns: **left** `flex = ORG.value + PERSON.value` containing ORG + PERSON cells stacked; **right** `flex = GPE.value + NORP.value` containing GPE + NORP. Each cell `flex = its value` → **tile area ∝ value**. Cell label `NAME (XX.XX%)`, background = type color, white text. (`renderEntMap(hostId,data)` generalizes this: `data.slice(0,2)` → left col, rest → right col — used for the 7-type full map in Explore.)
### Legend (`#db-ent-legend`)
One `sq` swatch + type name per entity. Colors are fixed per type (the swatch/tile color IS the encoding; there is no sequential scale).
### Interactions
Click a tile → `entDrill(...)` (drills into that entity type). Card **Explore Data** → `openTopEntitiesExplore()` (§10.6). **Insights** (`SRC.entities`): dominant type, ORG+PERSON combined share, GPE+NORP geo/group share, per-type rank.

**Full 7-type map** (`entMapFull`, used in Explore): ORG 37.12 `#8d7ba8`, PERSON 33.64 `#6b7fb0`, GPE 13.03 `#6bb0bd`, NORP 6.77 `#5fb088`, PRODUCT 3.07 `#b6d95a`, LOC 1.34 `#5cc98a`, LAW 5.03 `#e8c14a`.

---

## 10. Explore drill-downs

Pattern: `_showExplore(wrapId)` adds `.explore-open` to the page and `.on` to the target `.db-explore-wrap` (hides the overview, shows the full-page drill-down). Breadcrumb "Overview / …" with `closeTimelineExplore()` to return. Each drill mounts its own charts.

### 10.1 `openTotalPostsExplore()` → `#db-totalposts-explore`
1. **Platform Exposure** bar (reuses `ExposureBar`).
2. **Top Influencers** bar (`TpInfluencerBar`): `TP_INF` (12 rows `{name,platform,posts,score,eng,exposure}`), X = Post Count domain `[0,12]`, bar color blue (`twitter #4aa3ff` else `#2563eb`), Y label = `name (PlatformLabel)`.
3. **Per-platform cards** (`renderTpPlatforms`): 6 cards (facebook/twitter/instagram/youtube/reddit/tiktok) each a bar-list from `TP_PLATFORMS[pk]` (name + horizontal bar sized to max + count); empty platforms show "No Data Found".
4. **Influencer cards** (`renderTpInfCards`, `TP_INF`): avatar (first letter) + one platform badge + stats **Post Count / Influencer Score / Eng. Score / Platform Exposure**.
   (No posts table in this view.)

### 10.2 `openTopInfExplore()` → `#db-topinf-explore`
Top Influencers bar (`TpInfluencerBar`) · **Influencer Story Value Distribution** (bubble `InfluencerBubble` + bar `inflDesc`, tabs `setTiInfTab`) · per-platform cards (`TP_PLATFORMS`) · influencer cards (`TP_INF`) · **Posts table** (`renderTiPosts`).

### 10.3 `openMostEngagingExplore()` → `#db-mostengaging-explore`
1. **Top Influencers** bar (`MeEngTopBar`, `ME_INF`, X domain `[0,60]`).
2. **Comparison of Top Profiles**: bubble (`MeEngBubble`, `meEngData`) X=Post Count domain `[0, max+4]`, **Y=Engagement Score domain `[0,35]`**, bubble r = `6 + score*1.4`; + bar (`MeEngBar`, desc by posts); tabs `setMeInfTab`.
3. **Frequency Distribution of Posts** (`MeEngFreq`): bins 0…10 = count of `ME_INF` with `floor(parseFloat(score))===bin`; X=Engagement Score, Y=Post Count, bars `#2563eb`.
4. Per-platform cards (`ME_PLATFORMS`) · influencer cards (`ME_INF`) · Posts table.

`ME_INF` / `meEngData` (12 rows): BNSATOfficial posts 56 eng 7200 score 7.20 … (full set in app.js 7546–7581).

### 10.4 `openDomExplore(platform)` → `#db-dom-explore` (shared panel)
Driven by `DOM_DATA[platform]` (`{label,color,icon,inf[],bubble[],freq[]}` for all 6 platforms, app.js 7693–7830). Dynamic titles set from `platLabel`:
- Crumb "Most Dominant - {label}"; "{label} Story Value Distribution"; "{label} Posts Distribution"; "Top Influencers for Company News - {label}".
1. **Top Influencers** bar (`d.inf`): integer-safe domain `[0, maxPosts + max(ceil(maxPosts*0.25),1)]`, bars in platform color. Clicking a bar locks selection (others dim to 0.4) and opens that influencer's posts (`_domInfPosts` — real `socialMentions` for that platform+handle first, padded with same-platform posts).
2. **Story Value bubble** (`d.bubble`): X=Post Count domain `[0, maxX+30%]`, Y=Story Value domain `[0, ceil(maxSv/2)*2+2]`, bubble r = `6 + score*1.4`; + **bar** (`setDomInfTab`).
3. **Posts Distribution histogram** (`d.freq` = 11 `[value,count]` pairs): X=Story Value, Y=Post Count (integer ticks), bars platform color.
4. Influencer cards (`d.inf`) · **Posts table scoped to `platform`** (`renderTiPosts(id,0,platform)`).

### 10.5 Tonality explore — `openTonalityExplore()` → `#db-tonality-explore` (social `renderTonalityExplore`)
- **3 per-sentiment platform donuts** (Neutral/Positive/Negative) from `TON_PLAT` (`[platform, pct, count]`), colors `TON_PLAT_COLORS` (Facebook `#3d7fd6`, Twitter `#29b6d8`, Instagram `#d6337f`, Youtube `#e0245e`); legend per donut. Zero-count platforms dropped; empty → "No data".
- **Tonality Timeline** (`TonTimeline`): 3 lines Negative/Neutral/Positive over Jun 30–Jul 06; colors `#dc2626`/`#9ca3af`/`#16a34a`; Y domain `[0,8]`.
- **3 per-sentiment influencer bar-lists** (`TON_INF`): each row name + bar (color by platform suffix) + "N Post/s".
- **Posts table** (`renderTiPosts`).

### 10.6 Entities explore — `openTopEntitiesExplore()` → `#db-entities-explore` (social)
- **Top Entities post-count bar** (`SocTopEntitiesBar`, `SOC_TOP_ENTITIES = [['Chi Atienza',1],['NPDC',1]]`), bars `#3d7fd6`.
- **Per-platform entity cards** (`ENT_PLATFORMS`, 4 platforms; most empty "No Data Found").
- **Entities Map** (`renderEntMap('db-entities-map', entityData)`, the 4-type map).
(MediaWatch variant instead: `TopEntitiesBar` of `topEntitiesBar` [GCash 102, Philippines 72, …], a keyword cloud `entKeywords`, and the 7-type `entMapFull`.)

### Data tables used by Explore
- **`renderTiPosts(hostId,page,platform?)`** — social posts table from `WS_DATA.socialMentions` (optionally filtered by platform), 10/page. Columns: ☐ · **Estimated Reach** · **Eng Score** · **Post** · **Source** · **Sentiment** · **Influencer** · **As of** · (actions). Row → opens post preview (`openInsSocial`).
- **`renderMentionsTable(hostId,page,title,sub)`** — news table from `mentionData`, 10/page. Columns: ☐ · **Story Value** · **AVE** · **Headline** · **Media Outlet** · **Sentiment** · **Date Published** · (actions). (Used by MediaWatch / some compare tables.)
- The side **Insights article list** (`renderInsTable`→`renderArtTable`, variant `'social'`) columns: **Post / Est. Reach / Eng Score / actions**, 15/page, sortable (sent/reach/eng).

---

## 11. Compare Topics

### Entry: modal (`openCompareModal` → `#cmp-overlay`)
`renderCompareModal()` lists `COMPARE_CATS` as checkbox groups, each group has a parent checkbox + topic children:
```
Company News - DITO Telecommunity        (+ 9 topic children)
Competitor News - Globe Telecom          (+ 8)
Competitor News - PLDT / Smart Comms…    (+ 13)
Competitor News - Converge ICT           (+ 8)
```
`cmpParentToggle(gi)` checks/disables all children. `cmpUpdate()` enables the **Compare** button only when **≥2 "selections"** (a checked group counts as 1; otherwise each standalone checked child counts). `doCompare()` collects selected group names → `closeCompareModal()` → `openCompareView(sel)`.

### `openCompareView(cats)` → `#db-compare-explore`
Default cats (if <2) = `['Company News - DITO Telecommunity','Competitor News - Globe Telecom']`. `_cmpCats` = up to **4** topics, each assigned `CMP_COLORS = ['#7c3aed','#ea580c','#2563eb','#16a34a']`. Renders, in order:

1. **Chips** (`renderCompareChips`): one per topic, bordered/colored, + "Clear All".
2. **Overview table** (`renderCompareOverview`, social uses `CMP_OVERVIEW_SOCIAL`): rows = metrics, columns = topics. Each row `[metric, [val0,pct0], [val1,pct1], [sub0,sub1]]`; topic columns map by `ci%2` (values wrap for 3–4 topics). Negative pct shown red. **Rows are clickable** → `openCompareDetail(metric,row)`. Metric column width shrinks as topics grow (38%/28%/22%). Social rows: Total Results, Top Influencer, Most Engaging Posts, Top Entity, Most Dominant - Facebook/Twitter/Instagram/Youtube (with "N post/s" sub-labels; "No Data" greyed).
3. **Timeline** (`CompareTimeline`): one line per topic from `cmpTimelineData` (c0..c3; c2/c3 mirror c0/c1), colored per topic, legend plainline. Click a point → Insights for that date.
4. **Platform Exposure** (`renderCompareMedia`): one donut per topic from `CMP_PLATFORM_DIST` (`[[Facebook 75 81, Twitter 18.52 20, Instagram 5.56 6, Reddit 0.93 1],[Facebook 62.69 42, Twitter 29.85 20, Instagram 7.46 5]]`), colors `CMP_PLATFORM_COLORS` (Facebook `#3d7fd6`, Twitter `#29b6d8`, Instagram `#d6337f`, Reddit `#f0a6c4`, Youtube `#e0245e`). Grid: 2→2, 3→3, 4→2×2. Per-donut legend `name: pct% (count)`.
5. **Media Type Breakdown** (`renderCompareMediaTypeStats`, social matrix): platform rows × metric groups (`Avg. Inf. Score, Total SValue, Total Posts, Total Videos, Total Tweets, Total Comments, Total Likes`) × topic columns; `N/A` where a metric doesn't apply. Data `CMP_MT_SOCIAL`.
6. **Tonality** (`renderCompareTonality`): per-topic stacked time-bars (`CmpTonBar`, `CMP_TON_TIMELINE[ci]`), same P/N/Ng colors and top-rounding as §5.
7. **Frequency** (`renderCompareFrequency`): per-topic histograms (`CmpFreqChart`, `CMP_FREQ[ci]` counts, buckets 0…10, `#b9a4f7`).
8. **Influencer Story Value** (`renderCompareInfluencer`): per-topic bubbles (`CmpInfluencerBubble`, `CMP_INFLUENCER[ci]`), X=Post Count, Y=Story Value (auto to `max(20, ceil(maxSv/10)*10)`), bubble r via `InflDot` (`6+score*1.4`), with brush.
9. **Share of Voice** (`renderCompareSoV`): 3 donuts — **Articles** (`[82,533,82,300]`), **Story Value** (`[195.67,0,120,60]`), **AVE** (`[16.4,287.4,50,120]` → `'PHP {v}M'`); slices colored per topic; legend `name: share% (value)`.
10. **Entities Map** (`renderCompareEntities`): per-topic treemaps (`CMP_ENTMAP[ci]`, 7-type) + legends, stacked.

### `openCompareDetail(metric, el)` — row drill-down router (social)
- **Total Results** → `openCmpTotalPosts()` (`#db-cmpd-totalposts`): chips · per-topic Platform Exposure donuts · per-topic **Top Influencers** bar-lists (`CMP_TOP_INFLUENCERS`) · Timeline · influencer cards.
- **Top Influencer** → `openCmpTopInf()` (`#db-cmpd-topinf`): per-topic Top Influencers bar-lists · per-topic Influencer Story Value bubbles · influencer cards · posts table.
- **Most Engaging Posts** → `openCmpMostEngaging()` (`#db-cmpd-mep`): per-topic Influencer bubbles · per-topic Frequency histograms · per-topic **Top Profiles by Engagement Score** bar-lists (`CMP_ENGAGEMENT`, unit "Eng. Score") · cards · posts.
- **Most Dominant - {Platform}** → `openCmpMostDominant(platform)` (`#db-cmpd-dom`): per-topic Frequency + Influencer bubbles from `DOM_DATA[pk]` (topic 0 = full set; topic 1+ = half slice / 0.4× counts; **YouTube topic 1 = "No Data"**) · cards · posts scoped to platform.
- **Top Entity** → `openCmpTopEntity()` (`#db-cmpd-ent`): per-topic entity bar-lists (`CMP_TOP_ENTITIES`) + per-topic treemaps (`CMP_ENTMAP`, stacked full-width).
- Any other metric → side Insights panel with a seeded post list.

(MediaWatch's `openCompareDetail` builds `#db-compare-detail` with a shared "Media Exposure + Top Publishers" block and one of six per-metric views — Total/TopPub/Author/Medium/Tonality/Entity — selected by regex on the metric name. Not needed for the social mobile target but the HTML scaffolding exists.)

---

## 12. Color palettes (authoritative)

> ⚠️ The web code uses **several different platform palettes** for different charts. Reproduce per-chart, don't unify.

### Platform brand (`SOCIAL_PLATFORMS`, used for KPI avatars, channel-card icons)
`facebook #1877f2 · twitter #000000 · instagram #e4405f · youtube #ff0000 · reddit #ff4500 · tiktok #111111`
(`ONE_SOC_SET` influencer-card badges use the same but twitter via X-logo SVG; facebook `#1877F2`.)

### Platform Exposure bar (`_EXP_PLAT_ALL`)
`facebook #3b7dd8 · twitter #29a3f0 · instagram #d6249f · youtube #ef4444 · reddit #f97316 · tiktok #8b5cf6`

### Media Source Distribution scatter (`mediaSourceData`)
`Facebook #1877f2 · Twitter #16a34a · Instagram #1e293b · YouTube #ef4444 · Reddit #f97316 · TikTok #8b5cf6`

### Top Media Sources swimlane (`TMS_SRC`)
`Facebook #1877f2 · Twitter #f97316 · YouTube #ef4444 · Reddit #ff4500 · Instagram #16a34a`

### Compare Platform Exposure (`CMP_PLATFORM_COLORS`) / Tonality-explore donuts (`TON_PLAT_COLORS`)
`Facebook #3d7fd6 · Twitter #29b6d8 · Instagram #d6337f · Reddit #f0a6c4 · Youtube #e0245e`

### Sentiment / tonality
- Primary (`tonColors`, bar+donut+compare): **Positive #16a34a · Neutral #9ca3af · Negative #dc2626**.
- Timeline-Insights sentiment dots (`toneColor`): positive `#16a34a`, **negative `#e94f37`**, neutral `#9ca3af`.

### Timeline chart
Results bars `#16a34a` · story-value line & Bollinger band `#b9a4f7` (band @0.22) · projected-avg line `#9ca3af` (dashed) · band max tooltip `#b9a4f7` / min `#cfc3f3` · brush area stroke `#16a34a` fill `#86d9a8` · zebra `rgba(24,29,38,0.04)` · grid `#f0f1f3`.

### Frequency
bars `#b9a4f7`, dimmed `#e8e1fb`, brush stroke `#b9a4f7` / fill `#ece6fb`.

### Entities (fixed per type)
`ORG #8d7ba8 · PERSON #6b7fb0 · GPE #6bb0bd · NORP #5fb088 · PRODUCT #b6d95a · LOC #5cc98a · LAW #e8c14a`.

### Compare topics (`CMP_COLORS`)
`#7c3aed · #ea580c · #2563eb · #16a34a` (by topic index).

### Compare Share-of-Voice / media donuts
Reuse per-topic `CMP_COLORS` (SoV) and `CMP_PLATFORM_COLORS` (exposure) above.

### Neutrals / chrome
Axis text `#6b7280`/`#9ca3af`/`#4b5563` · grid lines `#f0f1f3`/`#eef0f2` · axis line `#e4e6ea` · tooltip bg `#181d26` (text white, labels `rgba(255,255,255,0.62)`).

### Publisher-score bubble palette (MediaWatch only, `pubScoreData`)
Per-publisher: `#ec4899 #a855f7 #10b981 #f59e0b #22d3ee #374151 #ef4444 #0ea5e9 #8b5cf6 #84cc16 #f97316 #16a34a #db2777 #3b82f6`.

---

## Data fields each chart requires (model checklist)

To support this dashboard, the mobile data model needs, per social post (`socialMentions` row already provides most): `platform`, `influencer`, `sentiment` (positive/neutral/negative), `engScore`, `reach`, `type` (Text/Photo/Video), `date`/`ago`/`time`, `post` text, `followers`, `influencerScore`, `match`, `engagement{}`, `keywords[]`, `entities[]`, `url`, `thumb`.

Aggregate/mock inputs each widget consumes:

| Widget | Required fields |
|---|---|
| KPI cards | per card: `label`, `value`, `detail` (e.g. "N posts"), `deltaPct` (+static), `deltaDir`, `avatarLetter`, `platform/brandColor`; Total Results = Σ platform post counts; Top Influencer = max-posts account |
| Timeline | per day: `date` ("D. Mon"), `fullDate`, `results` (count), `storyValue`, `projAvg`, `band[min,max]`; range selector 3/7/15/30 |
| Platform Exposure | per platform: `label`, `count`, `color`; normalized to % share |
| Channel cards (social) | per platform: list of `[statLabel, value]`; FB `reactions[[emoji,n]]`; `notes[]` |
| Tonality donut | per tone: `value` (count) → % of total |
| Tonality time-bar | per date: `{Positive,Neutral,Negative}` counts |
| Frequency histogram | buckets 0–10: `count` of posts per (floored) story-value bucket (per-platform `_PLAT_FREQ` when filtered) |
| Top Media Sources | per platform: `count`, `color`; per post: timestamp (Jul 1–8), `influencer`, y-jitter |
| Influencer Story Value | per influencer: `name`, `posts`, `sv` (storyValue), `score` (influencerScore→bubble size), `color` |
| Media Source Distribution | per platform: `postCount`, `storyValue`, `color` |
| Entities Map | per type: `name`, `value` (% share), `color`, `desc` |
| Explore: Top Influencers | per influencer: `name`, `platform`, `posts`, `score`, `eng`, `exposure` (`TP_INF`/`ME_INF`/`DOM_DATA.inf`) |
| Explore: per-platform lists | `TP_PLATFORMS`/`ME_PLATFORMS`/`ENT_PLATFORMS`: per platform `[name, count][]` |
| Most Engaging | `meEngData`: `name,posts,sv(=engagement),score,color`; frequency bins floor(score) |
| Dominant (per platform) | `DOM_DATA[p] = {label,color,icon, inf[], bubble[], freq[[value,count]]}` |
| Compare Overview | per metric row: `label`, per-topic `[value, pct]`, per-topic sub-label |
| Compare Timeline | per date: value per topic (`c0..c3`) |
| Compare Platform Exposure | per topic: `[platform, pct, count][]` |
| Compare Tonality | per topic: time series `{date,Positive,Neutral,Negative}` + donut `{name,value}` |
| Compare Frequency | per topic: bucket→count map |
| Compare Influencer | per topic: `{name,posts,sv,score,color}[]` |
| Compare SoV | per metric (Articles/Story Value/AVE): value per topic |
| Compare Entities | per topic: 7-type `{name,value,color}[]`; `CMP_TOP_ENTITIES` `[name,count][]` |
| Posts table | `socialMentions` rows (reach, engScore, post, platform/source, sentiment, influencer, date) |
