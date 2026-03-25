# 清微旅行 Brand Entity and Indexing Plan

> **For Codex / Claude:** This is a strategy-and-execution handoff for strengthening the brand association `清微旅行 = 清邁親子包車` and improving index coverage for the official website.

**Goal:** Help Google understand that `清微旅行 Chiangway Travel` is the primary brand entity for `清邁親子包車 / 清邁親子旅遊規劃`, and focus crawl/index trust on the official site instead of third-party platforms.

**Current State:** The site already has working `robots`, `sitemap`, canonical tags, and Organization / LocalBusiness structured data. The likely issue is not a sitewide technical block, but weak brand-entity consolidation and insufficient concentration of internal/external signals around the official domain.

**Important Constraint:** Public frontend copy and layout should not be changed casually. Any rewrite should preserve the current design intent and only strengthen brand / SEO clarity where needed.

---

## 1. Core Diagnosis

The current problem is likely a combination of:

1. Google has not yet strongly learned that `清微旅行` maps to the official domain `https://chiangway-travel.com/`.
2. The site has informational content, but the commercial-service signal is still more distributed than concentrated.
3. Third-party surfaces such as Rezio, social profiles, and other mentions may still dilute the entity relationship.
4. Search Console coverage likely includes a mix of:
   - `Crawled - currently not indexed`
   - `Discovered - currently not indexed`
   - duplicate / canonical-selection cases

This means the first priority is **not** “publish more random articles”. The first priority is:

- strengthen the brand entity
- strengthen the main service entity
- tighten internal linking
- prioritize indexation for core commercial URLs

---

## 2. Target Entity Statement

All important surfaces should consistently teach Google the same sentence:

`清微旅行 Chiangway Travel 是由台灣爸爸 Eric 與泰國媽媽 Min 在清邁經營的品牌，專做清邁親子包車、親子旅遊規劃與中文溝通服務。`

This exact idea should appear, with natural wording variations, in:

- homepage
- car charter service page
- future About page
- footer / author bio
- social bios
- Google Business Profile
- LINE OA profile
- any remaining third-party profile pages

The rule is simple:

- `清微旅行` = brand
- `清邁親子包車` = primary service category
- `Eric + Min` = trust / real-person identity layer

Do **not** let different pages describe the business in conflicting ways.

---

## 3. Page-Level Rewrite Plan

### 3.1 Homepage

**Purpose:** Brand-definition page, not just a landing page.

**What Google should learn from the homepage:**

- who the brand is
- what the main service is
- where the service happens
- who it is for

**Must-have content signals in the first screen / first 200 words:**

- brand name: `清微旅行 Chiangway Travel`
- service phrase: `清邁親子包車`
- audience phrase: `親子家庭`
- identity phrase: `台灣爸爸 Eric + 泰國媽媽 Min`
- geography phrase: `在清邁`

**Recommended copy structure:**

1. H1 keeps the current tone, but ensure the visible copy or nearby supporting text clearly includes:
   - `清微旅行`
   - `清邁親子包車`
2. The first supporting paragraph should define the brand directly.
3. Add one short section lower on the page that explicitly answers:
   - `清微旅行是什麼？`
   - `清微旅行提供哪些服務？`

### 3.2 Car Charter Page

**Primary URL:** `/services/car-charter`

This should become the main URL for the service query cluster:

- 清邁親子包車
- 清邁包車
- 清邁親子旅遊包車
- 清邁中文包車

**Page requirements:**

- title and H1 remain tightly focused on `清邁親子包車`
- body content should repeatedly but naturally connect:
  - `清微旅行`
  - `清邁親子包車`
  - `台灣爸爸 Eric / 泰國媽媽 Min`
  - `兒童座椅 / 中文溝通 / 司機導遊分工`
- FAQ on this page should answer real booking-intent questions
- homepage and blog posts should link here consistently

### 3.3 About Page

**Recommended new URL:** `/about`

This page should exist primarily for entity clarity, not conversion.

**Purpose:**

- give Google a clean organization / founder / brand identity page
- give users a “who are you?” destination

**Include:**

- brand story summary
- founders
- location
- service scope
- audience
- official contact channels
- official site and social links

This page should link out to:

- homepage
- `/services/car-charter`
- `/tours`
- `/contact`

---

## 4. Blog Internal Linking Rules

Blog content should stop behaving like isolated articles and start behaving like a support system for the commercial pages.

### 4.1 Anchor Rules

Every article should include 2-4 contextual internal links using natural anchors such as:

- `清邁親子包車`
- `清微旅行`
- `清邁親子行程規劃`
- `清邁包車服務`
- `清邁親子旅遊`

### 4.2 Destination Rules

Default destination priority:

1. `/services/car-charter`
2. `/tours`
3. homepage `/`
4. one related blog post

### 4.3 Placement Rules

Each blog post should ideally have:

- 1 link in the intro or first third
- 1 link in the middle where the topic naturally connects to booking / planning
- 1 CTA or contextual link near the end

### 4.4 Topic Mapping

Use this mapping:

- transport / route / driver / how-to content -> link mainly to `/services/car-charter`
- itinerary / family memories / examples -> link mainly to `/tours`
- founder story / trust / local life -> link mainly to homepage and future `/about`

### 4.5 What Not To Do

- do not force the exact same anchor every time
- do not stuff `清邁親子包車` unnaturally into every paragraph
- do not let all CTA links point only to LINE without strengthening site-to-site internal links first

---

## 5. Search Console Triage Order

Do **not** try to fix all 25 excluded URLs at once. Prioritize by business value.

### Priority A: Inspect First

Inspect these URLs first in Search Console URL Inspection:

1. homepage `/`
2. `/services/car-charter`
3. `/tours`
4. `/contact`
5. top 3 most important blog posts

For each URL, record:

- indexed or not
- last crawl date
- user-declared canonical
- Google-selected canonical
- referrer / discovery source if shown
- live test result

### Priority B: Categorize the 25 Excluded URLs

Create a Notion board or table with these groups:

- `Crawled - currently not indexed`
- `Discovered - currently not indexed`
- `Duplicate / alternate canonical`
- `Soft 404 / thin content suspicion`
- `Other`

### Priority C: Decide Action by Category

**If `Crawled - currently not indexed`:**

- improve uniqueness
- improve internal linking
- add stronger contextual value
- do not blindly resubmit everything

**If `Discovered - currently not indexed`:**

- strengthen internal links
- ensure sitemap inclusion
- link from higher-authority pages

**If duplicate / canonical issues:**

- verify the canonical is correct
- remove competing duplicate paths
- ensure the internal links only point to the canonical version

---

## 6. External Entity Consolidation

Because brand understanding is not built from the website alone, align all controlled profiles.

### Required Standardized Naming

Use this as the default name format where possible:

- `清微旅行 Chiangway Travel`

### Required Standardized Short Description

Use a short version of this idea:

- `清微旅行是由台灣爸爸 Eric 與泰國媽媽 Min 在清邁經營的品牌，專做清邁親子包車與親子旅遊規劃。`

### Platforms to Align

- Instagram bio
- Facebook page intro
- LINE OA profile
- Google Business Profile
- YouTube / TikTok if used
- any remaining Rezio / third-party listing

### Rezio Handling

If Rezio is no longer part of the active business flow:

- update the profile to point back to the official site
- reduce its brand prominence if possible
- avoid letting it look like the primary brand home

---

## 7. Metrics to Watch

Track these weekly:

1. branded impressions for `清微旅行`
2. branded clicks for `清微旅行`
3. indexed page count in Search Console
4. impressions / clicks for:
   - `/`
   - `/services/car-charter`
   - `/tours`
5. average position for:
   - `清微旅行`
   - `清邁親子包車`
   - `清邁包車`

Do not judge success only by total traffic. The first win is:

- official site starts ranking for the brand
- core service page becomes the main destination for related commercial queries

---

## 8. Recommended Execution Order

### Phase A: Entity Consolidation

1. unify external profile naming
2. add / improve About page plan
3. tighten homepage brand-defining copy
4. strengthen `/services/car-charter` entity wording

### Phase B: Internal Linking

1. define a reusable blog linking rule
2. update top 5 highest-value posts first
3. ensure homepage / footer / author bio point to the correct commercial page

### Phase C: Search Console Triage

1. inspect the top 5 priority URLs
2. categorize the 25 excluded URLs
3. fix by category instead of one-by-one guesswork

---

## 9. Claude / Codex Handoff Notes

If a coding agent implements this plan, prioritize in this order:

1. audit and improve homepage entity clarity
2. audit and improve `/services/car-charter`
3. create `/about` page or a documented spec for it
4. add internal-linking improvements to existing blog templates / selected articles
5. document Search Console triage workflow in Notion or a follow-up plan

Do not:

- rewrite the public frontend style casually
- change large blocks of copy without preserving the founder / family tone
- chase long-tail blog publishing before the brand entity is stabilized

---

## 10. Suggested Next Deliverables

The next useful docs after this one are:

1. `Homepage + Car Charter entity rewrite brief`
2. `About page content brief`
3. `Blog internal-link rulebook`
4. `Search Console exclusion triage worksheet`
