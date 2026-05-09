# KataGo Trace Translator

GoAgent should never ask an LLM to guess why a move is good or bad. KataGo is the source of chess facts; the LLM is the teacher that explains those facts. The Trace Translator sits between them.

```text
KataGo Analysis Engine
  -> KataGoMoveAnalysis
  -> KataGoTracePacket
  -> LLM grounded teaching claims
  -> verifier / repair
```

## Why this exists

Raw winrate and a best move are not enough for a strong teaching explanation. A human teacher wants to know:

- whether the neural policy and MCTS search agree;
- whether a natural move was refuted by search;
- whether a low-policy move became strong after search;
- how much support a PV actually has;
- which ownership regions changed;
- whether the actual move resembles a level-appropriate human mistake.

The `KataGoTracePacket` summarizes those signals in a compact, auditable form.

## Fields

### `searchSummary`

Contains the best move, actual move, winrate loss, score loss, confidence and safe wording.

The LLM should use this as the high-level factual anchor.

### `candidateComparison`

Ranks the top candidates with:

- visits / edgeVisits;
- prior and prior rank;
- winrate and scoreLead;
- scoreStdev / utility / lcb when available;
- PV and PV visits;
- humanPrior / humanPolicy when available;
- teaching role.

Teaching roles include:

```text
best
actual
natural-but-refuted
low-policy-but-strong-search
human-likely-mistake
uncertain
```

### `policySearchDelta`

This is the core policy-vs-search explanation layer.

Examples:

```text
prior high + search high
  -> policy and search agree

prior high + search low
  -> natural move refuted by search

prior low + search high
  -> non-obvious search favorite
```

This lets the teacher explain “why this move looks natural but fails” or “why KataGo found a non-obvious tesuji”.

### `pvSupport`

PV is not automatically truth. The translator classifies PV support as:

```text
strong
medium
weak
```

Weak PV support forces cautious wording. The LLM must not describe a weak PV as inevitable.

### `ownershipSummary`

Ownership arrays are compressed into named board regions. The LLM should explain these as territory/thickness/safety changes, not as raw numeric arrays.

### `humanPolicySignals`

When KataGo human-model outputs are available, this identifies whether the actual move is also attractive to human policy. This is useful for student-level teaching.

If no human model is configured, the field is omitted and the teacher must not invent level-specific human-policy conclusions.

### `shallowSearchTree`

This is not the full internal MCTS tree. It is a compact, controlled tree derived from top candidates and PV lines:

```text
ROOT
  candidate A
    pv move 1
      pv move 2
  candidate B
    pv move 1
```

It is designed for LLM consumption. Do not dump raw MCTS logs into the prompt.

## Safety rules

The LLM must obey these rules:

1. Never invent coordinates, PV, winrate, score or joseki names.
2. If `tracePacket.searchSummary.confidence` is not `high`, use cautious wording.
3. If `pvSupport` is weak, only describe the first few moves as a reference variation.
4. If ownership is unavailable, do not claim ownership/territory swings.
5. If humanPolicySignals is unavailable, do not say “this is a common mistake for this rank”.
6. Do not show raw arrays to the student.

## Evaluation

Run:

```bash
pnpm eval:katago-trace
```

The script checks that the translator, types, KataGo request flags and teacher prompt are wired together.

## Future work

Next improvements should be evaluation-driven:

- true second-layer branch queries for top candidates;
- stronger ownership delta by comparing before/after/actual ownership arrays;
- humanSL profile mapping from student rank to KataGo human model profile;
- trace-based claim verification;
- real-teaching corpus cases for policy-search disagreement.
