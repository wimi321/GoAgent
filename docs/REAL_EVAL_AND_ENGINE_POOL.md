# Real Teaching Eval and KataGo Engine Pool

This document describes the next hardening step for GoAgent: real local quality
evaluation and an optional persistent KataGo analysis engine.

## Why this exists

GoAgent is a local desktop app. It does not need a server to evaluate quality.
Quality evaluation is a local or CI command, just like `pnpm test` or
`pnpm typecheck`.

The goal is to turn teaching quality into a repeatable check:

```text
SGF fixture
→ real KataGo analysis
→ real LLM teacher response
→ automatic scoring for unsupported coordinates, forbidden phrases,
  missing evidence references, and expected teaching terms
```

## Running real evaluation

Real evaluation is intentionally not part of default CI because it requires local
KataGo assets and an LLM API key.

```bash
export GOAGENT_REAL_EVAL=1
export GOAGENT_KATAGO_BIN=/path/to/katago
export GOAGENT_KATAGO_CONFIG=/path/to/analysis.cfg
export GOAGENT_KATAGO_MODEL=/path/to/model.bin.gz
export GOAGENT_LLM_BASE_URL=https://api.openai.com/v1
export GOAGENT_LLM_API_KEY=...
export GOAGENT_LLM_MODEL=gpt-5-mini

pnpm eval:real-teaching
```

Strict release/deep mode:

```bash
pnpm eval:real-teaching:strict
pnpm check:deep-teacher-quality
```

When the environment is not configured, `pnpm eval:real-teaching` prints a
skipped summary and exits successfully. Strict mode fails if configuration is
missing.

## Fixture shape

Fixtures live under:

```text
tests/fixtures/real-teaching/
```

Example:

```json
{
  "id": "corner-approach-real-001",
  "category": "current-move",
  "sgf": "(;GM[1]FF[4]SZ[19]KM[7.5]...) ",
  "moveNumber": 21,
  "student": {
    "level": "intermediate",
    "ageRange": "adult",
    "style": "rigorous"
  },
  "expected": {
    "mustMention": ["KataGo"],
    "mustNotMention": ["唯一", "必杀", "绝对"],
    "allowedBestMoves": [],
    "forbiddenMoves": []
  }
}
```

## Persistent KataGo engine pool

The persistent engine is opt-in:

```bash
export GOAGENT_KATAGO_ENGINE_POOL=1
```

When enabled, GoAgent reuses a long-lived `katago analysis` process for normal
query batches. The existing spawn-per-batch code remains the default fallback.

The persistent engine supports:

- per-batch IDs and response routing;
- live/during-search callbacks;
- timeout restart;
- cancellation by runId or analysis group;
- safe process restart after cancellation or malformed output.

KataGo does not expose a universal per-query cancellation primitive in the JSON
analysis protocol, so cancelling a running group restarts the persistent engine.
This is safer than letting stale long searches continue and leak responses into
later teacher tasks.

## Quality contract

Real eval checks are focused on objective quality first:

- unsupported coordinate mentions;
- forbidden overclaim phrases;
- missing required teaching terms;
- claims without evidence references;
- engine best move outside an allow-list when a fixture provides one.

Human coach review can be added later as an additional layer, but it is not a
prerequisite for this local real-eval pipeline.
