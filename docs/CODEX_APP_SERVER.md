# ChatGPT login through Codex App Server

GoAgent keeps its domain-specific teacher runtime and optionally uses Codex App Server as a ChatGPT account connection. Codex does not replace GoAgent's KataGo, board capture, knowledge, student profile, evidence, or teaching-quality logic.

## Runtime boundary

- Version is pinned in `data/codex/manifest.json` and `package.json`.
- Login data is stored below GoAgent's own application directory in `codex/`; it does not read or change the user's global Codex CLI or Codex Desktop login.
- Only GoAgent-provided dynamic tools are exposed to the model. Built-in command, file-editing, web, app, plugin, browser, computer, memory, and multi-agent features are disabled.
- The App Server runs in a temporary read-only working directory with network disabled. A request to use a non-GoAgent built-in tool interrupts the turn.
- Selecting ChatGPT never falls back to an API-key provider. Failures are shown for the selected connection.

## Preparing release assets

The native runtimes are downloaded from the official `@openai/codex` npm package and verified by exact size and SHA256. They are generated release inputs and are not committed to Git.

```bash
pnpm prepare:codex-runtime:mac
pnpm prepare:codex-runtime:win
pnpm check:codex-runtime
```

`build/afterPack.cjs` copies only the target architecture into the Electron resources directory. macOS signing and notarization therefore include the embedded executable. Release smoke testing must run the packaged binary with `--version` on each target platform.

The manifest SHA256 identifies the official unsigned source asset. Platform code signing legitimately changes executable bytes. The package smoke therefore requires either an exact source hash or valid platform-signing evidence, and always starts the native runtime on the matching build host to confirm the pinned version.

## Capability verification

Login alone is not a capability result. GoAgent's connection test performs three real turns:

1. deterministic text response;
2. visual recognition of a generated test image;
3. an actual experimental `dynamicTools` call handled by GoAgent.

All three must pass before `llmSetupStatus` becomes `verified`.
