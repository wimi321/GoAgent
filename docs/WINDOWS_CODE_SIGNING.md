# Windows Code Signing

GoAgent public beta installers should be code signed before distribution. Unsigned Windows builds are internal beta artifacts only and may trigger SmartScreen warnings.

## Option 1: EV/OV Certificate

Use a certificate from a trusted CA. Configure CI secrets instead of local paths:

- `WIN_CSC_LINK`: base64 `.pfx` content or secure URL.
- `WIN_CSC_KEY_PASSWORD`: certificate password.

electron-builder also recognizes `CSC_LINK` and `CSC_KEY_PASSWORD`, but prefer the Windows-specific variables when separate certificates are used.

## Option 2: Microsoft Trusted Signing

Microsoft Trusted Signing can be used through the electron-builder Azure signing path. Store account, endpoint, profile, and tenant values as CI secrets. Do not place tenant IDs, client secrets, or local certificate paths in the repository.

## Build

```bash
pnpm install
node scripts/prepare_katago_assets.mjs
node scripts/check_katago_assets.mjs --mode=release
pnpm dist:win
```

P0 beta publishes Windows x64 only:

- `GoAgent-0.2.0-beta.1-win-x64.exe`
- optional portable ZIP: `GoAgent-0.2.0-beta.1-win-x64-portable.zip`

Do not publish Windows ARM64 until `win32-arm64` KataGo assets and checks exist.

## Verification

On Windows:

```powershell
Get-AuthenticodeSignature .\release\0.2.0-beta.1\GoAgent-0.2.0-beta.1-win-x64.exe
signtool verify /pa /v .\release\0.2.0-beta.1\GoAgent-0.2.0-beta.1-win-x64.exe
```

The installer should show a valid publisher. If it is unsigned, mark the build as internal beta only.

## Current Blocker

Before tagging `v0.2.0-beta.1`, record Windows signing status in release evidence and complete `docs/WINDOWS_SMOKE_TEST.md`.
