# Kokoro Chinese ONNX bundle

GoAgent bundles a local Kokoro Chinese ONNX voice pack for offline teacher speech.

- Upstream model: `onnx-community/Kokoro-82M-v1.1-zh-ONNX`
- License: Apache-2.0 as stated by the upstream model card
- Default quantized model: `onnx/model_int8.onnx`
- Expected model SHA256: `58b9b997faeaf42b427bac24c8a6246b236b0561311f6b118318cd9d2f47acb1`

Large binary assets are not stored in ordinary source patches. Run:

```bash
pnpm prepare:tts-assets
pnpm check:tts-assets
```
