# Official Website Design

The selected direction is a calm Go room: warm paper, forest green, restrained gold and readable editorial headings. The homepage has one primary product and one primary action, followed by a three-step review journey and three common Windows builds. The full download page keeps every supported variant.

## Assets

- `public/images/review-room.webp`: generated photographic background, 2026-10-02. Brief: ivory left-hand negative space, soft greenery and a wooden Go table on the right, no text, no interface, no logo.
- `public/images/review-download.webp`: generated restrained ink-landscape and Go-stone background, 2026-10-02. Brief: quiet ivory left side, decorative landscape on the right, no text or interface.
- `public/images/lizzie-review.webp`: real LizzieYzy Next local-engine acceptance screenshot from 2026-10-01, converted to WebP without synthesized UI. No credentials or personal game names are shown.
- `SiteIcon.astro`: Bootstrap Icons 1.13.1 (MIT), imported from the pinned dependency. Existing brand and download icons are retained.
- The selected mockup and final screenshots are in `qa/2026-10-official-site/`; these QA files are not public website assets.

## Maintenance

Homepage copy is shared across seven locales in `src/data/home-copy.mjs`. Explanatory copy in `guide-copy.mjs` keeps AI setup and privacy statements consistent. Headings and body copy remain real HTML, not image text.

`DownloadChooser.astro` is used by both the homepage and download routes. Live release selection stays in `download-catalog.mjs`; UI status, retry and keyboard navigation stay in `download-ui.mjs`. Do not replace the live catalog with hardcoded sample versions or sizes.

The dev-only catalog proxy is fixed to one public endpoint. Production uses the existing direct endpoint and CORS policy. Tests live under `website/tests`, separate from desktop-application tests, and run after the website build.

See the repository-root `design-qa.md` for verification evidence and scope limits. Deploy only through the existing Cloudflare Pages workflow after review; this redesign does not migrate hosting or alter release assets.
