# Official Website Design QA

## 2026-10-19 redesign

result: automated checks passed and screenshots reviewed; maintainer review of the preview pending.

Scope:

- Homepage rebuilt around one real game: an SVG board of move 127 of the ear-reddening game with
  KataGo's suggestions and the real whole-game win-rate curve, a dark showcase with a new 2x
  screenshot of the application at the same position, a seven-tile feature bento (two real
  crops, five schematic tiles), three steps, the compact download chooser and a closing band.
- New header (application icon, LizzieYzy Next wordmark, one-row navigation, download button) and
  a dark footer with product, topic and community columns. The old footer gap and the default
  disclosure marker are gone.
- Guide, FAQ, privacy and changelog rewritten for all seven languages in one data file and one
  component; the unused per-language GoAgent copy was removed. Privacy now covers LizzieYzy Next
  first. The changelog summarizes next-2026-10-17.1.
- The four Chinese topic pages were rewritten without jargon and now use real screenshots.
- Removed three generated mock-ups of the interface (`lizzieyzy-next-workbench.jpg`,
  `goagent-workbench.jpg`, `go-tools-hero.jpg`) and three unused images; the contract rejects
  the mock-ups. New sharing image, favicon and touch icon from the application's own icon.
- No release assets, catalog, update protocol, R2 objects or DNS were changed.

Verification:

- `pnpm website:build`: 46 routes. `astro check`: 0 errors, 0 warnings. `node --test
  website/tests/*.test.mjs`: 17 passed. `pnpm check:website` passed.
- DOM measurements in headless Chrome with real scrollbars and the live catalog served to the
  page: 22 key pages (all seven homepages, downloads, guide, FAQ, privacy, changelog, topic
  pages) at 320, 390, 768, 1024, 1280, 1440 and 1920 px, and all 46 pages at 360 and 1280 px. No
  element outside the viewport, text contrast at least 4.5:1 (3:1 for large text), targets at
  least 40 px, no console errors.
- The desktop header keeps one navigation row from 1041 to 1280 px in all seven languages.
- Screenshots reviewed: homepage at 1440 and 390 px (zh-CN), the hero of every other language
  at 1440 px, English and Thai at 390 px, and every content and topic page at 1280 px.
  Fixed from that review: mid-word wraps in CJK headings and the hero lead, oversized Japanese and
  English headlines, Thai letter-spacing, and a contrast false alarm on the numbered stones.

Limits: Windows rendering (Microsoft YaHei, Segoe UI) was not observed on a Windows machine,
and no screen reader was used. Look at the Cloudflare Pages preview on Windows and macOS before
merging to `main`, because merging deploys to goagent.top.

## 2026-10-02 redesign

final result: passed

Date: 2026-10-02. Scope: local implementation and browser verification, not production deployment.

## Reference and comparison

- Selected direction: option 1, warm ivory paper, forest-green actions, Go-room photography, editorial serif headings.
- [Selected reference](website/qa/2026-10-official-site/selected-reference.png)
- [Rendered homepage, 1003 CSS px](website/qa/2026-10-official-site/home-final-1003.png)
- [Rendered homepage, 390 CSS px](website/qa/2026-10-official-site/home-final-390.png)
- [Rendered downloads, 1003 CSS px](website/qa/2026-10-official-site/download-final-1003.png)
- Reference and rendered page were inspected together at matching width, then the hero was compared again in readable, matching 1003 x 625 crops.
- Checked hierarchy, type scale, line breaks, color, imagery, spacing, section boundaries and real interactions. No unresolved P0/P1/P2 findings in this scope.

Intentional adaptations: use an actual recent application capture rather than the mockup's old UI; use library icons; show live release and size data; retain FAQ, privacy and community access; clarify that external AI service usage is not included. Page height adapts to readable copy rather than stretching a screenshot to match the reference. The full download page preserves advanced variants without crowding the homepage.

## Findings fixed and retested

- Primary download URL with a trailing slash returned 404 in development. Accept both slash forms, retain the official download canonical.
- Newly added image was absent in a stale dev server. Restarted and verified all image requests; no broken images in final capture.
- Reduced header, workflow and download spacing after the first visual comparison.
- Caption was low-contrast on photographic background. Added a small opaque-backed caption.
- macOS/Linux tabs showed the Windows core-update link. Now shown only on Windows; mouse and keyboard retest passed.
- Localhost is intentionally outside the production catalog CORS allowlist. A dev-only fixed-path proxy uses the real catalog; production output continues using the unchanged official endpoint.
- Catalog loading now times out and retries a bounded number of times; failed loading provides retry and GitHub backup.
- TensorRT buttons require distinct matching .001/.002 volumes. Invalid URLs, missing sizes or incomplete archives cannot become enabled downloads.
- Guides and FAQ no longer instruct users to install another application just to use AI commentary.

## Verification

- 46 static routes built successfully.
- Astro check: 0 errors, 0 warnings, 0 hints.
- 13 automated tests passed: catalog URL safety, schema, flavor/architecture selection, multipart validation, retries, timeout, size formatting, seven-language keys, built routes, local links/assets and duplicate IDs.
- Website contract check and git diff --check passed.
- Seven languages: homepage and downloads checked at 390px; all homepages checked at 1440px. No horizontal overflow or missing images. Chinese and English additionally checked at 320px; reference comparison at 1003px.
- Browser-tested homepage download, language navigation, mobile menu, Escape/focus restoration, OS tabs, ArrowLeft/ArrowRight/Home/End selection and Windows-only update visibility.
- Final browser log inspection: no warnings or errors.
- Live catalog: next-2026-09-26.2. All ten displayed binary/volume URLs returned HTTP 200 via HEAD, with Content-Length matching the catalog. No multi-gigabyte full downloads were performed.
- Production-origin CORS response explicitly allows https://goagent.top.

## Boundaries

No release assets, update protocol, R2 objects, production site or DNS were changed. No PR or deployment was performed. Browser checks used the local macOS in-app browser; this is not a Windows, Safari or screen-reader certification.

The application image reuses the real 2026-10-01 local acceptance capture. A fresh isolated Java process was started, but the native automation surface could not attach to its window; it was stopped without changing existing user configuration. No application UI was synthesized into the image.

## Reproduce

```sh
pnpm install --filter @goagent/website... --frozen-lockfile --ignore-scripts
pnpm website:build
pnpm --dir website exec astro check
node --test website/tests/*.test.mjs
pnpm check:website
git diff --check
pnpm --dir website dev --host 127.0.0.1 --port 4173
```
