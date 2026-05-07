# Teacher persona, sessions, silver eval, and release smoke

This upgrade adds the next quality layer for GoAgent after grounded evidence, shape recognition, and move-range review.

## Student level, age, and teacher style

The app settings now include:

- `defaultCoachLevel`: beginner, intermediate, advanced, dan.
- `defaultStudentAgeRange`: unknown, child, teen, adult, senior.
- `teacherStyle`: balanced, rigorous, gentle, strict, humorous.

These settings affect wording, pacing, terminology density, and training suggestions. They do **not** change factual claims. KataGo, TeachingEvidence, shape recognition, PV, coordinates, winrate, score lead, joseki names, and life-and-death claims remain evidence-bound.

## Teacher sessions

The right-side teacher now supports a session model:

- New session.
- Close/archive session.
- Restore recent session history.

Large board images are not persisted by the session store. The persisted data is the conversation text, tool logs, associated game/move metadata, and report references.

## PR #6 selective merge policy

PR #6 contributed valuable ideas:

- Move-range progression calculation.
- Text board rendering extracted from the teacher agent.

This patch imports those pieces selectively while keeping the existing `src/shared/moveRange.ts` boundary. It intentionally avoids reintroducing duplicate `src/main/lib/moveRange.ts` runtime imports in the renderer.

## Engine silver eval

`pnpm eval:engine-silver` validates fixtures under:

```text
tests/fixtures/engine-silver/
```

The current mode is a schema/silver-oracle gate. Once CI has KataGo assets, this can be upgraded to high-visit runtime scoring.

## KataGo engine pool telemetry

`katagoEnginePool.ts` tracks runtime tasks by priority:

- live
- teacher
- quick
- background

The first version is telemetry-oriented and prepares the codebase for a persistent engine queue. It records task lifecycle status and enables future release diagnostics.

## Release artifact smoke

`pnpm smoke:release-artifacts` checks real packaged artifacts when `release/` exists. In non-strict local mode it reports missing assets without failing. In release CI, set:

```bash
GOAGENT_RELEASE_ARTIFACT_SMOKE_STRICT=1
```

to fail when standard/NVIDIA/mac artifacts are missing or suspiciously tiny.

## New checks

```bash
pnpm eval:engine-silver
pnpm eval:teacher-style
pnpm eval:teacher-session
pnpm smoke:release-artifacts
pnpm check:teacher-quality
pnpm check:release-quality
```
