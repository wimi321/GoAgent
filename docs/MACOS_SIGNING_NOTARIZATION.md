# macOS Signing and Notarization

GoAgent public beta builds must be signed with a Developer ID Application certificate and notarized by Apple before publishing.

## Required Inputs

Use CI secrets or local environment variables. Do not commit certificates or passwords.

- `CSC_LINK`: base64 `.p12` content or a secure URL to the certificate.
- `CSC_KEY_PASSWORD`: password for the certificate.
- `APPLE_API_KEY`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`: preferred notarization credentials.
- Or `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`.
- Or `APPLE_KEYCHAIN`, `APPLE_KEYCHAIN_PROFILE`.

## Builder Configuration

`package.json` enables:

- `hardenedRuntime: true`
- `gatekeeperAssess: false`
- `entitlements: build/entitlements.mac.plist`
- `entitlementsInherit: build/entitlements.mac.inherit.plist`
- `notarize: true`

The bundled KataGo executable and dylibs live inside `Contents/Resources/data/katago`. They must be present before `pnpm dist:mac` so electron-builder can include them in the signed app bundle.

## Local Build

```bash
pnpm install
node scripts/prepare_katago_assets.mjs
node scripts/check_katago_assets.mjs --mode=release
pnpm dist:mac
```

## Verification

```bash
codesign --verify --deep --strict --verbose=2 "release/0.2.0-beta.1/mac-arm64/GoAgent.app"
codesign --verify --deep --strict --verbose=2 "release/0.2.0-beta.1/mac/GoAgent.app"
spctl --assess --type execute --verbose "release/0.2.0-beta.1/mac-arm64/GoAgent.app"
hdiutil verify "release/0.2.0-beta.1/GoAgent-0.2.0-beta.1-mac-arm64.dmg"
hdiutil verify "release/0.2.0-beta.1/GoAgent-0.2.0-beta.1-mac-x64.dmg"
```

If notarization is not handled automatically by electron-builder, submit and staple manually:

```bash
xcrun notarytool submit "release/0.2.0-beta.1/GoAgent-0.2.0-beta.1-mac-arm64.dmg" --keychain-profile "$APPLE_KEYCHAIN_PROFILE" --wait
xcrun stapler staple "release/0.2.0-beta.1/GoAgent-0.2.0-beta.1-mac-arm64.dmg"
xcrun stapler validate "release/0.2.0-beta.1/GoAgent-0.2.0-beta.1-mac-arm64.dmg"
```

Repeat for the x64 DMG.

## Current Blocker

If Developer ID credentials are not configured, macOS builds are internal unsigned/ad-hoc beta artifacts only. Do not tag `v0.2.0-beta.1` for public release until signing and notarization evidence is recorded.
