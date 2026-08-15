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
version="$(node -p "require('./package.json').version")"

codesign --verify --deep --strict --verbose=2 "release/$version/mac-arm64/GoAgent.app"
codesign --verify --deep --strict --verbose=2 "release/$version/mac/GoAgent.app"
spctl --assess --type execute --verbose=4 "release/$version/mac-arm64/GoAgent.app"
spctl --assess --type execute --verbose=4 "release/$version/mac/GoAgent.app"
xcrun stapler validate "release/$version/mac-arm64/GoAgent.app"
xcrun stapler validate "release/$version/mac/GoAgent.app"
xcrun stapler validate "release/$version/GoAgent-$version-mac-arm64.dmg"
xcrun stapler validate "release/$version/GoAgent-$version-mac-x64.dmg"
codesign --verify --verbose=2 "release/$version/GoAgent-$version-mac-arm64.dmg"
codesign --verify --verbose=2 "release/$version/GoAgent-$version-mac-x64.dmg"
spctl --assess --type open --context context:primary-signature --verbose=4 "release/$version/GoAgent-$version-mac-arm64.dmg"
spctl --assess --type open --context context:primary-signature --verbose=4 "release/$version/GoAgent-$version-mac-x64.dmg"
hdiutil verify "release/$version/GoAgent-$version-mac-arm64.dmg"
hdiutil verify "release/$version/GoAgent-$version-mac-x64.dmg"
```

electron-builder signs and notarizes each application bundle first, then signs
each final DMG through `build.dmg.sign=true` while its temporary signing
keychain is still active. The public release workflow submits each signed DMG
to Apple's notary service, requires an `Accepted` result, staples the DMG
ticket, and runs all checks above before upload. A missing Developer ID
signature, a rejected Gatekeeper assessment, a missing application or DMG
ticket, or a damaged DMG blocks publication.

If notarization is not handled automatically by electron-builder, submit and staple manually:

```bash
codesign --force --timestamp --sign "Developer ID Application: YOUR NAME (TEAMID)" "release/$version/GoAgent-$version-mac-arm64.dmg"
xcrun notarytool submit "release/$version/GoAgent-$version-mac-arm64.dmg" --keychain-profile "$APPLE_KEYCHAIN_PROFILE" --wait
xcrun stapler staple "release/$version/GoAgent-$version-mac-arm64.dmg"
codesign --verify --verbose=2 "release/$version/GoAgent-$version-mac-arm64.dmg"
xcrun stapler validate "release/$version/GoAgent-$version-mac-arm64.dmg"
spctl --assess --type open --context context:primary-signature --verbose=4 "release/$version/GoAgent-$version-mac-arm64.dmg"
```

Repeat for the x64 DMG.

## Release Policy

If Developer ID or Apple notarization credentials are unavailable, macOS
artifacts are internal-only. The public workflow must fail rather than upload an
unsigned or unnotarized application.
