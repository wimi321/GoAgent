# GoAgent Knowledge Matching QA

This document records the current knowledge coverage and the matching quality rules used by the Go teacher agent.

## Current Coverage

- Joseki / fuseki lines: 64
- Life-and-death problems: 124
- Tesuji problems: 63
- Pattern teaching cards: 44

The catalog already covers the P0 target breadth:

- Star point, 3-3 invasion, star point approach, komoku approach, avalanche, taisha, double approach, magic sword, Chinese fuseki, Sanrensei, Kobayashi, Mini Chinese, Nirensei, enclosure reduction, pincer joseki.
- True/false eyes, straight three, bent three, bulky five, rectangular six, plum six, grape six, board six, golden chicken, carpenter square, L group, seki, ko life, semeai, under the stones, throw-in, second-line hane, snapback eye shape, nakade, bent four in the corner.
- Snapback, throw-in, connect-and-die, probe-before-sacrifice, ladder, net, squeeze, wedge, crosscut, cut, clamp, peep, oil-rat endgame, monkey jump, hane at head, double atari, geta, sacrifice cut.

## Matching Rules

KataGo remains the factual judge. The knowledge system only explains and transfers the lesson.

The match engine ranks results using:

- Explicit user intent: joseki / life-death / tesuji words in the prompt.
- Position facts: move number, phase, region, current move, candidate moves, PV, and loss.
- Local features: corner, side, 3-3, 4-4, 3-4, first/second/third/fourth line, contact, jump, eye-shape.
- Local geometry: board snapshots are compared around candidate / played anchors with rotation and mirror normalization.
- Liberty / empty-point constraints: the candidate anchor must still be empty, and adjacent colors, edge contact, neighboring groups, and approximate liberties are scored.
- Exact evidence: catalog sequence overlap, answer move overlap, played move, candidate move, and PV overlap.

Important quality rules:

- Exact/strong matches may be described as a named joseki, life-death type, or tesuji type.
- Partial matches must be described as "similar to this type".
- Weak matches should not be used as the main teaching point.
- Joseki matches are suppressed when the prompt clearly asks for tactical reading or tesuji.
- Training problem recommendations ignore broad tags such as corner, direction, joseki, life-death, and tesuji; they require specific tags such as snapback, true/false eyes, bent three, or ladder.
- Geometry evidence is used only when at least three local stones match inside the analysis window. Color-swapped matches are allowed but scored lower.
- Geometry matches with weak liberty / empty-point compatibility are filtered out even if the visible stones look similar.

## Regression Scenarios

The automated matching smoke test covers:

- Star point 3-3: exact joseki matches rank first.
- True/false eye: exact life-and-death match ranks before broad corner patterns.
- Snapback: exact tesuji match ranks before broad joseki or generic corner life-and-death patterns.
- Named coverage: avalanche, plum six, and connect-and-die direct user prompts match their intended joseki / life-death / tesuji entries.
- Rotation / mirror coverage: a true/false-eye local shape rotated into a different board area still matches the intended life-and-death type through `geometry:*` and `liberties:*` evidence.

## Runtime Wiring

Current-move analysis now builds a board snapshot from the SGF main line immediately before the selected move. Captures are simulated before the snapshot is sent to the knowledge matcher, so stale captured stones should not pollute the local shape window and candidate anchors stay empty.

Whole-game and recent-game reviews also attach the board snapshot for the largest-loss issue when an SGF record is available. This lets the teacher match dead/alive and tesuji patterns from the actual local position instead of relying only on tags such as "problem move" or "corner".

## Next Content Expansion

Do not bulk-import copyrighted problem collections. Future additions should be original common-pattern reconstructions with sourceKind `common-pattern`.

Prioritized next joseki additions:

- More star point double-approach sub-branches with whole-board direction labels.
- More komoku avalanche / taisha follow-up branches with explicit "avoid complexity" and "fight" alternatives.
- 3-4 high pincer and low pincer modern AI branches.

Prioritized next life-and-death additions:

- Tripod group and more plum-six / grape-six variants with different liberties.
- More edge shortage-of-liberties examples with distinct answer coordinates.
- Semeai examples with shared liberties and ko threats separated.

Prioritized next tesuji additions:

- More connect-and-die / connection shortage variants.
- More probe-before-sacrifice sequences in center fighting.
- More geta/net examples with distinct local coordinates.

Before adding another large batch, continue improving geometric matching with explicit empty-point masks and local ownership features. The current matcher already handles rotation / mirror normalization plus approximate liberties; the next quality jump is to distinguish "same stones and similar liberties, but different vital empty points".
