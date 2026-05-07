# GoAgent Knowledge Matching

GoAgent uses KataGo as the factual judge and the local knowledge base as the teaching layer. The knowledge system should not only answer keyword questions; it should recognize common Go patterns well enough for the AI teacher to explain joseki, life-and-death shapes, tesuji, and training memory cues.

## Knowledge Layers

1. **Concept cards**: broad teaching ideas in `data/knowledge/p0-cards.json`, such as direction, thickness, shape, endgame, and review method.
2. **Markdown essays**: longer YiGo-style teaching notes under `data/knowledge/**`.
3. **Pattern cards**: structured joseki, tsumego, tesuji, and shape cards in `data/knowledge/pattern-cards.json`.
4. **Source registry**: licensing and usage notes in `data/knowledge/source-registry.json`.

Pattern cards are the most important layer for professional-looking teaching. Each card stores:

- `title`, `category`, `patternType`
- `phase`, `regions`, `levels`
- tags and aliases, including Chinese and common English names
- board signals such as `3-3`, `4-4`, `second-line`, `eye-shape`, `capture`
- trigger rules for recent moves, KataGo candidate moves, PV moves, loss size, and judgement
- canonical shape notes and example coordinates
- variations, choosing conditions, warnings
- teacher-facing recognition, correct idea, memory cue, common mistake, and drill

## Retrieval Rules

`searchKnowledge()` scores pattern cards with several independent signals:

- game phase: opening / middlegame / endgame
- board region: corner / side / center
- recent move geometry
- played move
- KataGo top candidate moves
- KataGo principal variations
- loss size and judgement
- user prompt and student profile tags

This means the teacher can retrieve a joseki card even when the user does not type the joseki name. For example, if the current position is in the corner, early in the game, and KataGo candidates include a 3-3 point, the star-point 3-3 cards become strong matches.

## Teaching Guardrails

Pattern matching is helpful but not omniscient. The teacher prompt tells the model:

- If the match is exact enough, say “这是某某定式/死活型”.
- If only the shape is similar, say “这像某某型”.
- Do not invent coordinates, winrate, score lead, joseki names, or variations.
- KataGo data decides whether the actual move was good or bad.
- Knowledge cards explain why the pattern is memorable and how the student should train it.

## GitHub Source Review

The knowledge base is expanded from public research, but GoAgent does not blindly import raw SGF/problem data.

- `sanderland/tsumego`: useful as a tsumego product and category reference. The repository has an MIT-style license, but the problem folders reference classic book collections, so raw positions are not imported.
- `SzalonySamuraj/Joseki-Master`: MIT licensed. Its collection taxonomy is useful for star-point and komoku joseki coverage planning.
- `billyellow/Kogo-s-Joseki-Dictionary`: no explicit license found. Do not import SGF data.
- `online-go/godojo-server`: joseki-feature server, but no explicit license found during review. Do not import code/data.
- `kovarex/tsumego-hero`: useful product architecture reference, but no top-level license found during review. Do not import problem data.
- `Josekipedia game collection`: states that its game database is Creative Commons. Treat as a future import candidate only after exact license terms and attribution handling are confirmed.
- `Wikipedia: Life and death` and `Wikipedia: Go`: useful for broad terminology checks around eyes, life status, semeai, ko, seki, corners, sides, and joseki. GoAgent uses original teaching text rather than copying article prose.
- `goproblems.com best practices`: useful as problem taxonomy reference. Do not import problem text or diagrams without permission.
- OGS Creative Commons discussion: useful policy reminder that archived or publicly posted Go books may still be all-rights-reserved.

When adding future material, keep the source registry updated with the review decision. A source marked `do-not-import` may still inspire original teaching categories, but it must not be copied into packaged data.

## Expansion Plan

Add future cards in small, verified batches:

1. Common star-point joseki families.
2. Common 3-4 point joseki families.
3. Corner life-and-death shapes.
4. Side life-and-death shapes.
5. Tesuji patterns: snapback, ladder, net, throw-in, shortage of liberties.
6. Common bad-shape corrections.

Avoid copying copyrighted problem collections. Store original teaching descriptions, compact pattern metadata, and links or citations only when the source license allows it.

Current pattern-card coverage includes 44 original cards across joseki, life-and-death, tesuji, and shape. The target for the next milestone is not just more cards; it is better matching precision:

- Add exact corner coordinate fingerprints for the most common star-point and komoku joseki.
- Add local-shape normalization so rotated and mirrored tsumego patterns match the same card.
- Add KataGo PV motif extraction, such as ko, throw-in, snapback, connection, cut, cap, and monkey jump.
- Add attribution fields if future cards are derived from explicitly licensed datasets.
