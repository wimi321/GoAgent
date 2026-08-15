# Download Center Design QA

## Scope

- Official homepage download entry
- Simplified Chinese download center
- Traditional Chinese, English, Japanese, Korean, Thai, and Vietnamese download pages
- Live stable catalog integration

## Visual Review

- [x] The page uses the existing GoAgent site header, footer, typography, and color system.
- [x] Windows and macOS choices are separated into clear platform panels.
- [x] NVIDIA, RTX 50, TensorRT, OpenCL, CPU, and no-engine choices are visible without technical setup copy.
- [x] Apple silicon and Intel Mac choices are clearly distinguished.
- [x] TensorRT is presented as two required download parts.
- [x] The small Windows update is visually secondary to full downloads.
- [x] Download sizes and the current stable tag are loaded from the live catalog.
- [x] Empty, loading, and retry states remain understandable without exposing infrastructure details.

## Interaction Review

- [x] All 10 generated download actions use HTTPS and the official download host.
- [x] Catalog URLs are validated before being assigned to buttons.
- [x] The catalog failure state offers retry and a direct download-page fallback.
- [x] Navigation and footer download links stay inside the official website.
- [x] Localized pages reuse one component, preventing layout and asset drift between languages.
- [x] Interactive controls have visible labels and generated accessible names.

## Result

Passed local Astro build, website contract checks, desktop browser review, localized content review, and live catalog population checks.
