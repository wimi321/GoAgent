# GoAgent TTS: Kokoro-first selected-provider design

GoAgent uses a strict selected-provider TTS design.

## Product policy

- Default provider: `kokoro-bundled`.
- Default language: `zh-CN`.
- Default asset target: `data/tts/kokoro/zh-CN`.
- Other languages are optional language packs.
- Custom TTS APIs are only used when the user explicitly selects a custom provider.
- GoAgent does not automatically switch providers when a selected provider fails.

If the selected provider is not ready, playback fails with a clear error and a repair action.

## Bundled Kokoro asset

The default bundled Chinese voice pack is based on:

```text
onnx-community/Kokoro-82M-v1.1-zh-ONNX
onnx/model_int8.onnx
onnx/model_quantized.onnx
```

The expected model size is about 127 MB and the expected SHA256 is recorded in
`data/tts/kokoro/zh-CN/manifest.json`.

`model_int8.onnx` is kept as the source asset requested by the release manifest.
`model_quantized.onnx` is the exact filename resolved by `kokoro-js` when the
selected bundled provider runs with `q8`.

Large binary assets are not stored in ordinary text patches. Prepare them before
release packaging:

```bash
pnpm prepare:tts-assets
GOAGENT_TTS_ASSETS_STRICT=1 pnpm check:tts-assets
GOAGENT_TTS_SMOKE_STRICT=1 pnpm smoke:tts
```

Strict smoke performs a real offline synthesis with the selected local zh-CN
voice. It does not call a system voice, Web Speech, or a custom API.

For the bundled zh-CN pack, GoAgent follows the official Chinese frontend route:

```text
teacher text -> misaki[zh] ZHG2P(version="1.1") -> Kokoro tokenizer -> generate_from_ids
```

Chinese teacher text must not be passed to `tts.generate(text)` because that can
route through the wrong upstream text frontend. GoAgent uses `misaki[zh]` only
for local Chinese G2P and then keeps inference inside the bundled Kokoro ONNX
runtime. The runtime also checks that the detected text language matches the
selected voice pack; if the text is clearly a different language, playback fails
with a readable error instead of producing a mismatched voice.

The Misaki bridge needs a local Python 3.10-3.13 runtime. GoAgent creates an
isolated TTS virtual environment under the app data directory and installs
`scripts/requirements-tts.txt` into that environment. If no suitable Python is
found, the bundled provider fails clearly instead of switching to a system voice
or custom API.

## Custom API providers

GoAgent supports explicit custom providers:

- `custom-openai-compatible`
- `custom-http-json`
- `external-local-service`

When a custom provider is selected, the text is sent to the configured endpoint.
When `kokoro-bundled` is selected, no custom API is called.

## Privacy

`kokoro-bundled` runs on local assets. Custom providers are user-configured and
must be treated as user-selected external processors.

## Runtime notes

The first version synthesizes completed teacher answers only. It should not
rewrite teacher content before speech. Speech text must be produced from the
already verified teacher markdown or structured result.
