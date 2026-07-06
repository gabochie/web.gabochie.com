# Product Requirements Document (PRD)
## Gideon Abochie — Conversion-Focused Web Design Sales Platform
**Version:** 4.0  
**Last Updated:** July 5, 2026  
**Author:** Gideon Abochie

---

## 1. Product Overview

A production-grade sales intelligence platform for a website redesign + CRO agency targeting North American businesses. The system sells **business outcomes** (revenue, conversions, automation), not just design. It manages 161 leads with growth-intent scoring, auto-generates ROI-focused proposals, and provides a client portal for feedback.

### 1.1 Business Model
- **Positioning:** "We turn your website into a revenue machine"
- **Primary Service:** Website Redesign + CRO (Conversion Rate Optimization)
- **Pricing:** Hybrid model — setup fee + monthly retainer
- **Revenue Target:** 10 clients × $3K/mo = $360K ARR + setup fees

### 1.2 Architecture
- **Static HTML/CSS/JS** — no build tools, no dependencies
- **Netlify** — deployment, serverless functions, form handling, security headers
- **Firebase** — Firestore for data persistence (leads, feedback, files, roadmap)
- **localStorage** — offline fallback when Firebase unavailable
- **Modular JS** — 8 independent modules

---

## 2. Folder Structure

```
gideonabochie.com/
├── index.html              # Public marketing site (conversion-focused)
├── admin.html              # Admin dashboard (NOT public-facing)
├── admin.css               # Dashboard styles (sidebar, roadmap, voice panel)
├── portal.html             # Standalone client portal (per-company auth)
├── portal.css              # Portal styles (sidebar, dashboard, feedback)
├── portal.js               # Portal logic (auth, feedback, files, timeline)
├── data.js                 # 161 leads with growth-intent fields
├── scoring.js              # Growth-intent scoring + real website analyzer
├── preview-engine.js       # On-the-fly redesign generator (20 themes)
├── proposal.js             # ROI-focused proposal generator
├── outreach.js             # 8 performance-focused templates
├── app.js                  # Admin app controller (sidebar nav, roadmap, tabs)
├── voice-assistant.js      # AI Voice Assistant (Web Speech API)
├── firebase-config.js      # Firebase init + data service layer
├── PRD.md                  # This file
├── privacy.html            # Privacy Policy (12 sections)
├── terms.html              # Terms of Service (13 sections, NY law)
├── cookies.html            # Cookie Policy (essential only, no tracking)
├── netlify.toml            # Deployment config, security headers, caching
├── netlify/
│   └── functions/
│       ├── analyze.js      # Serverless website analyzer (HTML fetch + 22 signals)
│       └── proposal.js     # Serverless proposal PDF generator
├── redesigns/              # 11 handcrafted HTML mockups
│   └── *.html
└── docs/
```

---

## 3. Public Frontend (`index.html`)

### 3.1 Conversion Funnel Architecture

| Section | Purpose | Conversion Mechanism |
|---------|---------|---------------------|
| Hero | Capture attention + leads | Lead capture form (name, email, URL, industry) |
| Social Proof | Build trust | $4T+ revenue, 11 redesigns, 4.9★ rating |
| Problem/Solution | Create urgency | Pain points → Our solution |
| How It Works | Reduce friction | 4 simple steps |
| Portfolio | Show results | Case studies with metrics |
| Pricing | Qualify leads | 3 retainer tiers |
| Testimonials | Social proof | Revenue metrics, not visual redesigns |
| FAQ | Handle objections | 5 common questions |
| Client Portal | Client retention | Password-protected redesign access |
| Sticky Bar | Always-visible CTA | "Get Free Score" + WhatsApp |
| Exit Popup | Capture leaving visitors | Audit offer before exit |

### 3.2 Lead Capture Points
1. **Hero form** — "Get Your Free Website Audit" (primary)
2. **Sticky bottom bar** — Always visible CTA
3. **Exit-intent popup** — Catches leaving visitors
4. **Portfolio CTAs** — Each case study links to audit
5. **Final CTA** — "Your competitors' sites are modern. Is yours?"
6. **WhatsApp** — Quick contact button

### 3.3 Client Portal
- Company dropdown (16 companies with redesigns)
- Password authentication (shared: `nology2026`)
- After login: company info, redesign preview link, feedback form
- Feedback → WhatsApp (`+233243262019`) + email (`gideon@gideonabochie.com`)

### 3.4 Pricing Tiers
| Tier | Setup | Monthly | Includes |
|------|-------|---------|----------|
| Essentials | $5K-$25K | — | 5-page redesign, mobile-first, SEO |
| Professional | $10K-$75K | — | 10-page custom, UI/UX, content, CMS |
| Enterprise | $20K-$150K | — | Unlimited, custom apps, CRM, training |

**Note:** Retainer pricing ($1.5K-$5K/mo) presented in proposals, not on public site.

---

## 4. Admin Dashboard (`admin.html`)

### 4.1 Tabs
| Tab | Purpose |
|-----|---------|
| Discover | Search leads by growth intent (ads, traffic, CVR) |
| Dashboard | Dual-mode lead management (Enterprise / Main Street) |
| Finder | Website analyzer with conversion gap detection |
| Outreach | Performance-focused template library + tracker |
| Strategy | Sales playbook with growth-intent criteria |

### 4.2 Discover Tab
- Industry + state filters
- Sort by: Growth Score, Name, State, Revenue, Traffic, CVR
- Results as cards with: growth score, traffic, CVR, ad spend, proposal/preview buttons
- Pagination: 20 per page

### 4.3 Dashboard Tab
- **Mode Toggle:** Enterprise (116) / Main Street (45)
- **Stats:** Total leads, opportunity value, states covered, engaged, avg growth score
- **State Grid:** Clickable tiles grouped by region
- **Lead Table:** Company, state, industry, revenue, traffic, CVR, ad spend, status, growth score, proposal button

### 4.4 Finder Tab
- URL input + "Analyze" button
- **Scorecard:** Design / Mobile / Performance / Total
- **Conversion Gaps:** Detected issues
- **Pre-Qualification Checklist:** Running ads, 5K+ traffic, CVR <3%, no automation, $2M+ revenue
- **Save to Leads:** Auto-fill form

### 4.5 Outreach Tab
- **8 templates** in 4 categories (Cold High-Intent, Cold Competitive, Cold Value-First, Follow-Up, Proposal, Relationship)
- **Outreach Tracker:** Leads with Contacted/Meeting/Proposal status

---

## 5. Core Modules

### 5.1 `data.js` — Data Layer
- 116 enterprise + 45 main street leads
- New growth-intent fields per lead:
  - `adSpend` — Monthly ad spend ($500-$50,000)
  - `monthlyTraffic` — Monthly visitors (1,000-500,000)
  - `conversionRate` — Current CVR (0.5%-4.5%)
  - `emailListSize` — Email subscribers (0-50,000)
  - `hasAutomation` — Has email automation (boolean)

### 5.2 `scoring.js` — Growth-Intent Scoring
**Score (0-100) based on:**
- Running ads: +20
- High traffic + low conversion: +25 (biggest CRO opportunity)
- No automation: +15 (upsell opportunity)
- Revenue $2M+: +10
- Target industry: +10
- Has email list: +5

**Red Flags:**
- Low traffic (<5K/mo — can't run tests)
- No paid acquisition
- Outside core vertical
- Revenue under $500K
- Already high CVR (>4% — limited upside)

**Opportunity Calculator:**
- Current leads = traffic × CVR
- Potential leads = traffic × 3.5% (benchmark)
- Additional leads = potential - current
- Monthly opportunity = additional leads × deal value × close rate

### 5.3 `preview-engine.js` — On-the-Fly Redesign Generator
- 20 industry themes with distinct palettes
- `generateHTML(name, industry, state, city)` → complete HTML document
- `openPreview(name, industry, state, city)` → opens in new tab
- Repositioned as "Your Conversion-Optimized Site Preview"

### 5.4 `proposal.js` — ROI-Focused Proposals
**Structure:**
1. The Opportunity (traffic × CVR = revenue gap)
2. Current State Analysis (conversion gaps)
3. Proposed Solution (Redesign + CRO + Automation)
4. ROI Projections (month 1, 3, 6, 12)
5. Investment (setup + monthly retainer)
6. Why Us
7. Next Steps

### 5.5 `outreach.js` — Performance-Focused Templates
- "You're spending $X on ads but converting at Y%"
- "Your competitors are automating. Here's what you're missing"
- "Quick math: a 1% conversion lift at your traffic = $X/month"

### 5.6 `app.js` — App Controller
- Tab navigation
- Mode toggle (Enterprise / Main Street)
- Discover with growth-intent filtering/sorting
- Dashboard with stats, state grid, filterable lead table
- Finder with conversion gap analysis
- Outreach rendering
- Proposal and notes modal management

---

## 6. Design System

### 6.1 Color Palette
```css
--bg: #0b0b0f;
--surface: #121216;
--accent: #e63946;
--green: #22c55e;
--yellow: #f59e0b;
```

### 6.2 Typography
- Primary: Inter (Google Fonts)
- Display: varies by industry

---

## 7. External Integrations

### 7.1 WhatsApp
- Number: `+233243262019`
- Used for: Client feedback, contact form, lead capture

### 7.2 Email
- Address: `gideon@gideonabochie.com`
- Used for: Client feedback, contact form, lead capture

---

## 8. Revenue Model

| Metric | Target |
|--------|--------|
| Setup fee (avg) | $7,500 |
| Monthly retainer (avg) | $3,000 |
| Clients (year 1) | 10 |
| ARR | $360,000 |
| Setup revenue | $75,000 |
| **Total year 1** | **$435,000** |
| Client LTV (24 months) | $79,500 |

---

## 9. Key Metrics to Track

| Metric | Target |
|--------|--------|
| Lead → Client conversion | 5-10% |
| Avg deal size | $7,500 setup + $3K/mo |
| Client retention | 12+ months |
| Time to ROI (client) | 60-90 days |
| Conversion lift delivered | 40-60% |

---

## 10. Browser Support
- Chrome 90+, Firefox 90+, Safari 14+, Edge 90+
- Mobile: iOS Safari 14+, Chrome for Android 90+

---

## 11. Security Notes
- Admin dashboard NOT linked from public site
- Client portal uses per-company unique credentials
- Firebase Firestore for data persistence (replaces localStorage-only)
- Security headers: X-Frame-Options, CSP, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- Honeypot spam protection on all forms
- No sensitive data stored in plaintext

---

## 12. Production Features

### 12.1 Netlify Deployment
- `netlify.toml` — deployment config, security headers, caching rules, Lighthouse plugin
- Serverless functions in `netlify/functions/` for website analysis + proposal generation
- Netlify Forms with honeypot spam protection
- Performance caching: JS (1 year), HTML (5 min), images (1 week)

### 12.2 Firebase Backend
- `firebase-config.js` — Firebase initialization + data service layer
- Firestore collections: leads, feedback, files, timeline, settings
- Automatic localStorage fallback when Firebase unavailable
- Per-company data isolation in client portal

### 12.3 Real Website Analyzer
- Server-side HTML fetch via Netlify Function (no CORS issues)
- 22+ conversion signals checked: title, meta, OG tags, HTTPS, viewport, responsive CSS, lazy loading, analytics, forms, CTAs, social proof, schema markup
- Client-side fallback via CORS proxy for development

### 12.4 Client Portal
- Standalone `portal.html` — per-company authentication
- 24-hour session management with auto-expiry
- 5 views: Overview, Redesign Preview (iframe), Feedback, Timeline, Files
- File upload with drag-and-drop, category tagging, size limits
- Firebase-backed persistence (localStorage fallback)

### 12.5 Legal Compliance
- `privacy.html` — 12 sections (data collection, usage, sharing, retention, cookies, security, rights, international transfers, children)
- `terms.html` — 13 sections (services, disclaimers, proposals, portal, IP, payments, confidentiality, liability, warranty, termination, NY governing law)
- `cookies.html` — essential cookies only, no tracking, no advertising cookies, DNT respect
