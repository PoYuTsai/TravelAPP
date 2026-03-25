# Search Console Exclusion Triage Worksheet

> **For Eric / Codex / Claude:** Use this worksheet to classify the excluded URLs in Google Search Console before changing code or copy. The goal is to avoid random fixes and focus on the highest-value URLs first.

---

## 1. Priority Order

Inspect these first:

1. `https://chiangway-travel.com/`
2. `https://chiangway-travel.com/services/car-charter`
3. `https://chiangway-travel.com/tours`
4. `https://chiangway-travel.com/contact`
5. Top 3 highest-value blog posts

Only after these are reviewed should the remaining excluded URLs be batch-triaged.

---

## 2. URL Inspection Log Template

Use one row per URL.

| URL | Page Type | Indexed? | GSC Status | Last Crawl | User Canonical | Google Canonical | In Sitemap? | Internal Links Strong? | Content Thin? | Action |
|-----|-----------|----------|------------|------------|----------------|------------------|-------------|------------------------|---------------|--------|
| `/` | homepage | Yes/No | e.g. Crawled - currently not indexed | YYYY-MM-DD | ... | ... | Yes/No | Strong / Medium / Weak | Yes/No | ... |

**Page Type options:**

- homepage
- service
- tours hub
- tour detail
- blog hub
- blog detail
- contact
- legal
- other

---

## 3. Status Classification Rules

### 3.1 Crawled - currently not indexed

This usually means Google saw the page but did not think it was valuable enough yet.

**Common fixes:**

- strengthen internal links
- increase uniqueness
- make the page more obviously useful
- improve topical connection to core site entities

### 3.2 Discovered - currently not indexed

This usually means Google knows the URL exists but has not spent crawl budget on it yet.

**Common fixes:**

- link the URL from stronger pages
- ensure the page is in sitemap
- reduce orphan / weakly linked content

### 3.3 Duplicate / alternate canonical

This means Google found another version it prefers.

**Common fixes:**

- verify declared canonical
- stop linking to non-canonical variants
- remove duplicate pathways if unnecessary

### 3.4 Soft 404 / thin content suspicion

This is common when the page exists but feels too weak, too templated, or too low-value.

**Common fixes:**

- enrich the content
- improve intent match
- merge weak pages if needed

---

## 4. Action Decision Tree

### If the page is a high-value commercial page

Examples:

- homepage
- `/services/car-charter`
- `/tours`

Then:

- fix immediately
- strengthen internal links from sitewide or strong pages
- resubmit after improvements

### If the page is a mid-value informational page

Examples:

- strong blog posts
- FAQ-style blog posts with business relevance

Then:

- improve internal links
- improve relevance to main service / brand entity
- resubmit selectively

### If the page is low-value

Examples:

- weak legal-adjacent thin pages
- older articles with very little differentiation
- pages with weak user intent match

Then:

- do not prioritize first
- evaluate merge / keep / ignore

---

## 5. Recommended Notion Properties

If you put this into Notion, use these columns:

- `URL`
- `Page Type`
- `Priority`
- `Indexed`
- `GSC Status`
- `Last Crawl`
- `User Canonical`
- `Google Canonical`
- `In Sitemap`
- `Internal Link Strength`
- `Entity Alignment`
- `Thin Content Risk`
- `Next Action`
- `Owner`
- `Completed`

### Suggested values

**Priority**

- P1
- P2
- P3

**Internal Link Strength**

- Strong
- Medium
- Weak

**Entity Alignment**

- Strong
- Medium
- Weak

**Thin Content Risk**

- High
- Medium
- Low

---

## 6. P1 Starter Queue for 清微旅行

Start with this exact queue:

1. homepage `/`
2. `/services/car-charter`
3. `/tours`
4. `/contact`
5. blog post: founder story
6. blog post: Chiang Mai transportation
7. blog post: one strongest family-planning article

The reason is simple:

- these URLs define the brand
- these URLs define the service
- these URLs are the best candidates to teach Google that `清微旅行 = 清邁親子包車`

---

## 7. What Not To Do

- do not submit all 25 excluded pages for indexing at once
- do not assume every excluded page deserves to be indexed
- do not publish more articles before the core entity pages are stable
- do not change copy randomly without recording what changed

---

## 8. Immediate Next Step

Open Search Console and fill this worksheet for the first 7 P1 URLs.

Once that is done, the next best document to create is:

- `P1 URL fixes summary`

That summary should say, for each URL:

- what the current problem is
- what should be changed
- whether it needs code, content, or both
