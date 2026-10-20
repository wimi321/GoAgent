# Official Website Design

Direction (2026-10-19 refresh): a calm, modern Go room, in warm paper, forest green and a little
wood-gold.

The homepage has one product and one primary action. It continues with three review steps, six
features and the three common Windows builds. The full download page keeps every supported variant.

## Principles

- **System fonts only.** Each locale gets the best face its OS ships:
  - zh-CN: PingFang SC / Microsoft YaHei
  - zh-Hant: PingFang TC / Microsoft JhengHei
  - ja: Hiragino Sans / Yu Gothic UI
  - ko: Apple SD Gothic Neo / Malgun Gothic
  - th: Sukhumvit Set / Leelawadee UI
  - en, vi: system UI

  The earlier serif headings fell back to SimSun on most Windows PCs. Web fonts are not used:
  they would be heavy for CJK, and Google Fonts is blocked in mainland China. The homepage quote
  uses the local Kai (楷体) face as its one decorative accent.
- **No 100vw.** Bands span the page because `main > *` centers content per section, and the
  header and footer pad with `calc((100% - var(--max)) / 2)`. `width: 100vw` adds a horizontal
  scrollbar next to classic Windows scrollbars. `scripts/check_website.mjs` rejects it, and
  `html { overflow-x: clip }` is only a safety net.
- **Vector Go motifs instead of photos.** The hero draws a faint board grid with star points in
  CSS, fading out toward the edges. Two CSS stones rest on the real application screenshot. Nothing is generated
  imagery.
- **Icons follow text color.** `SiteIcon.astro` inlines Bootstrap Icons 1.13.1 (MIT) from the
  pinned dependency, so `color` styles them. Do not recolor icons with CSS filters.
- **Contrast and targets.** Body text is at least 4.5:1 and large text at least 3:1. Use
  `--gold-ink` for gold text. Interactive elements are at least 40 px tall.

## Files

- `src/styles/site.css`: tokens, per-locale font stacks, header, footer, buttons, and the
  components of the content pages (`page-hero`, `doc-card`, `faq-list`, `compare-*`, …).
- `src/styles/home.css`: hero, review steps and feature grid.
- `src/styles/download.css`: the download chooser, both full and compact.
- `public/images/lizzie-review.webp`: the real LizzieYzy Next screenshot from 2026-10-01. It is
  the only hero image.

## Maintenance

Homepage copy, including `featuresTitle`, `featuresLead` and the six `features`, is shared across
seven locales in `src/data/home-copy.mjs`. Every feature must describe something the application
does today. Explanatory copy in `guide-copy.mjs` keeps the AI setup and privacy statements
consistent. Headings and body copy stay real HTML, never text inside images.

`DownloadChooser.astro` is used by both the homepage and the download routes. Live release
selection stays in `download-catalog.mjs`, and UI status, retry and keyboard navigation stay in
`download-ui.mjs`. Do not replace the live catalog with hardcoded sample versions or sizes.

See the repository-root `design-qa.md` for verification evidence and its limits. Deploy only
through the existing Cloudflare Pages workflow, after a maintainer has looked at a preview
deployment.
