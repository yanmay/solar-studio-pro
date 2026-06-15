# Website Audit, SEO, and Accessibility Fixes Design Spec

This specification outlines the technical design for resolving crawlability, SEO, accessibility, and legal policy issues flagged in the website audit scan of SUNPOWER LINK.

## Goal Description

Resolve 4 critical failures and 24 warnings identified by the `squirrelscan` website audit:
1. **Crawlability & Sitemaps**: Valid sitemap generation (`/sitemap.xml`) to prevent dynamic HTML index responses.
2. **SEO Head Elements**: Set charset early, add canonical link, limit description length, and support Open Graph / Twitter card image assets.
3. **Accessibility (A11y)**: Add main landmark, H1 title tag, semantic structure, and internal links for search crawlers by embedding static fallback markup inside `<div id="root">`.
4. **Legal Compliance**: Add a dedicated dark-themed Privacy Policy page route and footer links to establish credibility (EEAT).

---

## Proposed Changes

### Component: Metadata & Fallback Architecture

#### [MODIFY] [index.html](file:///c:/Users/noobg/solar-studio-pro/index.html)
- Move `<meta charset="UTF-8" />` to the very top of `<head>`.
- Add `<link rel="canonical" href="https://sunpowerlink.in/" />`.
- Shorten meta description to 147 characters.
- Add `<meta property="og:image" content="https://sunpowerlink.in/og-image.png" />`.
- Add `<meta name="twitter:image" content="https://sunpowerlink.in/og-image.png" />`.
- Inject a semantic HTML skeleton inside `<div id="root">` containing:
  - `<header>` with `<nav>` mapping key navigation links.
  - `<main>` with `<article>` and `<h1>` title.
  - `<section>` details for technology and analyzer access.
  - `<footer>` with a link to `/privacy` (Privacy Policy).

---

### Component: Routing & Pages

#### [MODIFY] [App.tsx](file:///c:/Users/noobg/solar-studio-pro/src/App.tsx)
- Import `PrivacyPage` from `./pages/PrivacyPage`.
- Add `<Route path="/privacy" element={<PrivacyPage />} />`.

#### [NEW] [PrivacyPage.tsx](file:///c:/Users/noobg/solar-studio-pro/src/pages/PrivacyPage.tsx)
- Create a premium dark-mode styled page using TailwindCSS and custom CSS variables consistent with the rest of the application.
- Render header with a "Back to Home" link and standard section components mapping local GIS and location processing rules.

#### [MODIFY] [LandingPage.tsx](file:///c:/Users/noobg/solar-studio-pro/src/pages/LandingPage.tsx)
- Update footer link to point to `/privacy` using React Router's `<Link>` or standard layout logic.

#### [MODIFY] [ResultsPage.tsx](file:///c:/Users/noobg/solar-studio-pro/src/pages/ResultsPage.tsx)
- Update footer link to point to `/privacy`.

---

### Component: Static Crawling Assets

#### [NEW] [sitemap.xml](file:///c:/Users/noobg/solar-studio-pro/public/sitemap.xml)
- Standard XML sitemap listing indexable URLs: `/`, `/map`, and `/privacy`.

#### [MODIFY] [robots.txt](file:///c:/Users/noobg/solar-studio-pro/public/robots.txt)
- Reference `https://sunpowerlink.in/sitemap.xml` directly.

---

## Verification Plan

### Automated Verification
- Re-run `python test_webapp.py` to confirm no regressions are introduced in the existing E2E flows.
- Re-run the audit CLI command:
  ```bash
  npx squirrelscan audit http://localhost:8080 --format llm
  ```
  Verify that the health score improves and sitemap, H1, landmark, and content thinness errors are completely resolved.
