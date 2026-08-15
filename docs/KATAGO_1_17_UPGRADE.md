# KataGo 1.17 Upgrade

GoAgent's standard desktop packages use KataGo `1.17.1` with the official balanced Transformer model.

## Release matrix

| GoAgent package | KataGo backend | Engine version | Default model |
| --- | --- | --- | --- |
| macOS Apple Silicon | Metal | 1.17.1 | Transformer 10B Balanced |
| macOS Intel | Metal | 1.17.1 | Transformer 10B Balanced |
| Windows x64 Standard | OpenCL | 1.17.1 | Transformer 10B Balanced |
| Windows x64 NVIDIA | CUDA/CUDNN | 1.17.1 | Transformer 10B Balanced |

KataGo `1.17.2` only publishes TensorRT binaries and fixes TensorRT-specific issues. It is not a general replacement for the Metal, OpenCL, or CUDA/CUDNN packages above. A future TensorRT edition must be explicitly labelled and validated as a separate package.

## Default model

- File: `b10c512h8nbt3tflrs-fson-silu-rsnh.bin.gz`
- Size: `94,281,753` bytes
- SHA-256: `c04db4a503721d948bb720324f3cbdac6088cc9eb243632f020e4b6846f58995`
- Source: the official KataGo `v1.17.1` release

The settings page also offers official lightweight and strong Transformer models. Only the balanced model is marked as recommended.

## Compatibility rules

- Transformer presets require KataGo `1.17.0` or newer.
- Bundled release binaries must match the exact engine version declared by `data/katago/manifest.json`.
- An older user-installed engine is not silently paired with a Transformer model.
- Runtime directories are copied as a whole so backend libraries are not lost.
- Model downloads are resumable and must pass both size and SHA-256 checks before activation.
- KataGo binaries and neural network files remain release assets; they are not committed as ordinary Git files.

## Verification

```bash
pnpm prepare:katago-transformer
node scripts/check_katago_assets.mjs --mode=release
pnpm test
pnpm typecheck
pnpm build
```

On each target platform, also run a real short analysis to confirm that the backend initializes and loads the Transformer model. A successful version probe alone is not sufficient release evidence.
