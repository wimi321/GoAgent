# Official Website Design

Direction (2026-10-19 redesign): a quiet Go room. Warm paper and wood for the light bands, a deep
night green for the bands that show the real application, forest green for actions and a little
gold for accents.

The homepage tells one story with one game: move 127 of Honinbo Shusaku's "ear-reddening game"
(1846, public domain). The hero draws that position as a wooden board with KataGo's suggestions,
and the dark showcase below shows the same position in the real application. Then come the feature
bento, three steps, the compact download chooser and a closing call to action. The full download
page keeps every supported variant.

## Principles

- **Real product, real data.** Every picture of the application is a real screenshot of
  LizzieYzy Next. The hero board is drawn in SVG from the SGF (`src/data/earred.mjs`), its
  suggestions and win rate are the ones the application showed for that position, and the
  sparkline is KataGo's real win-rate curve for the game. Never use generated mock-ups of the
  interface; `scripts/check_website.mjs` rejects the old ones.
- **System fonts only.** Each locale gets the best face its OS ships:
  - zh-CN: PingFang SC / Microsoft YaHei
  - zh-Hant: PingFang TC / Microsoft JhengHei
  - ja: Hiragino Sans / Yu Gothic UI
  - ko: Apple SD Gothic Neo / Malgun Gothic
  - th: Sukhumvit Set / Leelawadee UI
  - en, vi: system UI

  Web fonts are not used: they would be heavy for CJK, and Google Fonts is blocked in mainland
  China. Numbers and Latin labels in the board and cards use `--font-latin`. The closing quote
  uses the local Kai (楷体) face as its one decorative accent.
- **Line breaks.** CJK headings are split into phrases after full-width commas
  (`src/lib/phrases.mjs`), so they wrap between phrases instead of inside a word. Korean uses
  `word-break: keep-all`. Thai never gets letter-spacing, which separates its vowel and tone marks.
- **No 100vw.** Bands span the page because `main > *` centers content per section, and the
  header and footer pad with `calc((100% - var(--max)) / 2)`. `width: 100vw` adds a horizontal
  scrollbar next to classic Windows scrollbars. `scripts/check_website.mjs` rejects it, and
  `html { overflow-x: clip }` is only a safety net.
- **Icons follow text color.** `SiteIcon.astro` inlines Bootstrap Icons 1.13.1 (MIT) from the
  pinned dependency, so `color` styles them. Do not recolor icons with CSS filters.
- **Contrast and targets.** Body text is at least 4.5:1 and large text at least 3:1. Use
  `--gold-ink` for gold text on light bands and `--gold-light` on dark ones. Interactive elements
  are at least 40 px tall.
- **Motion is decoration.** Entrance and pulse animations are short and are switched off under
  `prefers-reduced-motion`.

## Files

- `src/styles/site.css`: tokens, per-locale font stacks, header, footer, buttons, the shared
  section heading, and the components of the content pages (`page-hero`, `doc-card`,
  `faq-list`, `release-card`, `compare-*`, …).
- `src/styles/home.css`: hero, showcase, feature bento, steps and closing band.
- `src/styles/download.css`: the download chooser, both full and compact.
- `src/components/GoBoard.astro`: the SVG board in the hero.
- `src/components/ContentPage.astro`: guide, FAQ, privacy and changelog in every language.
- `public/images/lizzie-earred-127.webp` and its two crops (`lizzie-curve-problems.webp`,
  `lizzie-candidates.webp`): the real application at move 127, captured at 2x on 2026-10-19
  from a build of lizzieyzy-next `main` (38bca4b6) on macOS.
- `public/images/lizzieyzy-next-icon.png`, `public/favicon-48.png` and
  `public/apple-touch-icon.png`: the application's own icon (`packaging/icons/app-icon-1024.png`
  in lizzieyzy-next).
- `public/images/og-lizzieyzy-next.jpg`: the 1200 x 630 sharing image.

## Maintenance

Homepage copy lives in `src/data/home-copy.mjs` and the other pages' copy in
`src/data/pages-copy.mjs`, both for seven languages. Button and menu names quote the
application's own labels in that language (the application has no Vietnamese interface, so the
Vietnamese pages quote the English ones). Every feature and privacy statement must describe what
the released application does today. Headings and body copy stay real HTML, never text inside
images.

`DownloadChooser.astro` is used by both the homepage and the download routes. Live release
selection stays in `download-catalog.mjs`, and UI status, retry and keyboard navigation stay in
`download-ui.mjs`. Do not replace the live catalog with hardcoded sample versions or sizes.

See the repository-root `design-qa.md` for verification evidence and its limits. Deploy only
through the existing Cloudflare Pages workflow, after a maintainer has looked at a preview
deployment.
