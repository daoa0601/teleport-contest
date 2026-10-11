# Private held-out set plan

## Implementation status

The local generation pipeline now exists. It produced 2,500 validated native-C
sessions across adaptive play, deep debug games, and ten scenario families.
See `docs/holdout-generation.md` for commands and `.cache/holdout-dev/summary.json`
for actual coverage. These are dev-private recordings, not a sealed evaluation
set. A separate evaluator with inaccessible credentials and restricted outputs
has not been created. The composition below remains a proposed sealed design,
not a claim about the development pool's distribution.

## Why

The public score stopped measuring progress once it could be reached by
overfitting. On the 2026-10-03 leaderboard, several agentic entries score 44/44
public sessions and 0–2/44 held-out. This fork scored 44/44 public with 0/44
held-out until the Aug 30 fixture removal. We need a number that rises only when
the port generalizes, and the agent must not be able to see what produces it.

## What already exists

- The patched C recorder is built at `nethack-c/recorder/install/games/lib/nethackdir/nethack`.
- `scripts/record-session.mjs` takes a session skeleton (`seed`, `datetime`,
  `nethackrc`, `moves`) and records a judge-format v5 `.session.json`, one key
  at a time, using the recorder's sync markers.
- `frozen/ps_test_runner.mjs <dir>` scores any directory and prints a JSON results
  bundle.

So the missing pieces are key-plan generation, the composition design, and access
control. The recording engine is already there.

## Three tiers

| Tier | Size | Who sees sessions | Purpose |
|---|---|---|---|
| Public | 44 (fixed) | Agent | Debugging and examples |
| Dev-private | Unbounded, grows | Agent | Coverage of paths the public set misses; debug freely |
| **Sealed** | 88 sessions, ~21k steps | **Nobody in an agent session** | Measures generalization; reports aggregates only |

The dev-private set is what rohitgandikota's `tools/gen-sessions/` provides.
It improves coverage but does not measure overfitting, because the agent can
fit to it just as it fit to the public set. Only the sealed tier answers "does
this generalize?"

## Composition of the sealed set

Calibrate against what we know of the judge's held-out pool: 44 sessions and
10,538 steps (about 240 steps each). The judges have said harder sessions may be
added, with "deeper dungeon levels, more subsystems, more multi-segment
save/restore chains, rarer monsters and items". Use 88 sessions (2× the judge
pool) to reduce variance.

Each session is drawn from stratified axes. The quotas below are per 88 sessions.

| Axis | Distribution | Public reference |
|---|---|---|
| Role | All 13 roles, 5–8 each; the rest random (`role` unset) | Wizard-heavy (9), 8 random |
| Race / alignment | Every legal race for each role at least once; random otherwise | Mostly human |
| Datetime | 60% ordinary, at mixed times of day; 10% each full moon, new moon, Friday 13th; 10% night (affects undead/werecreatures) | 27/44 use `20000110090000` |
| Options | ~85% `symset:DECgraphics`; also `!autopickup`, `runmode:*`, `!legacy`, `!tutorial`, `disclose`, `SYMBOLS=`, `BIND=`, `showexp`/`time` | Same option families |
| Mode | ~30% `playmode:debug` (wishes, `#levelchange`, polymorph, rare items) | 13/44 |
| Segments | 75% single; 10% save→restore; 10% death→new game (bones, record); 5% chains of 3 or more | 4/44 multi |
| Length (steps) | 35% <60, 25% 60–150, 25% 150–400, 15% 400–1800 | 17/10/9/8 |
| Depth | 50% DL1–2, 30% DL3–6, 20% deep (Mines, Sokoban, quest, Gehennom via debug) | Mostly DL1 |

Seeds: draw at random from 10,000–2³¹, excluding every public seed. Keep seeds
and names out of the repo. Name sessions by an opaque hash, never by content.

## Generating key plans

Every generator drives the **C recorder only**. JavaScript is never involved in
choosing keys, so no generator can be biased toward what the port already does.

1. **Scenario recipes (about 25% of sessions).** These are short hand-written
   templates with parameter slots (inventory letters, directions, counts) for
   rare subsystems: save/restore, bones, death chains, prayer timing, shops,
   riding, two-weapon fighting, spellcasting, engraving, polymorph, wishes. The
   template fixes the intent. Seed and role vary, so the same recipe never
   yields the same game twice.
2. **Prompt-aware grammar fuzz (about 40%).** A weighted random command grammar:
   - movement and run/rush
   - `s` with counts, plus `i`, `e`, `q`, `r`, `z`, `t`, `a`, `w`, `W`, `P`, `R`, `T`, `o`, `c`, `^D`
   - `#pray`, `#chat`, `#force`, `#sit`, `#enhance`, travel `_`, `<` and `>`

   The fuzzer reads the C screen after each key, so it answers `--More--`,
   y/n, direction, inventory and menu prompts with valid choices most of the
   time. It also deliberately cancels (`ESC`) or picks invalid answers about 10%
   of the time. This reaches many prompt and cancel paths cheaply.
3. **Screen-reading explorer, a "sherpa" bot (about 35%).** A greedy policy on
   the C screen:
   - explore unseen squares
   - fight adjacent hostiles with `F`+direction
   - pick up items, eat when Hungry
   - pray at low HP
   - descend when `>` is visible

   This produces the long, deep games the judges plan to escalate toward. The
   public sessions' `recorded_with: sherpa_compose_multi.py` suggests the judges
   generate theirs in a similar way.

All three generators share one driver: the recorder process plus a screen
parser. Build that once on top of `scripts/lib/session-driver.mjs`.

## Pipeline

```
recipe/fuzz/sherpa → skeleton (seed, datetime, nethackrc, moves)
  → scripts/record-session.mjs → candidate.session.json
  → validate → seal (outside the repo) → score (aggregate only)
```

Validation rejects a candidate if any of these hold:
- Recording it a second time gives a different result (nondeterminism).
- The game ends early or the key plan runs past the end of the game.
- The final screen is waiting on a prompt that the key plan does not answer.
- The step count falls outside its length quota.
- It duplicates the opening of another sealed session (same seed, or same rc
  plus the same first 50 keys).

Pipeline check, done 2026-10-03. Two public sessions were re-recorded:
`seed0077-rogue-chargen`, and the two-segment save/restore session
`seed0013-friday13-save-then-fullmoon-restore`. `key`, `rng`, `screen`,
`cursor` and `animation_frames` matched the originals on every step. The only
difference is the per-step `depth` field, which the re-recording omits and the
scorer does not read. The local recorder, timezone and driver therefore match
the judge's pipeline for scored channels. Re-check one long public session
(over 1,000 steps) before sealing the first batch.

## Access control

The agent works in this repo with permission checks bypassed. Anything readable
from this machine's user account is effectively readable by the agent, so a
deny rule is not a sufficient seal.

Recommended setup:

- The sealed sessions live in a **separate private GitHub repo**, for example
  `teleport-holdout`. It holds the sessions, the generator outputs and a
  scheduled GitHub Action.
- The Action checks out `daoa0601/teleport-contest` at HEAD and overlays the
  `frozen/` files the way the judge does. It runs `ps_test_runner.mjs` with the
  judge's timeouts, then appends aggregates to `results.csv` and a job summary:
  - screen %
  - RNG %
  - full passes
  - per-tier step totals
  - the public-vs-sealed gap
- It never prints per-session diffs, session names, seeds or first-divergence
  steps.
- This repo gets only a read-only badge or the CSV. Agents never get access to
  the holdout repo.

A cheaper interim option is a directory outside the repo, scored by a script
that you run yourself, never an agent.

## Metrics and decisions

- **Primary:** sealed screen-match fraction, the same partial-credit metric the
  judge uses.
- **Overfitting alarm:** public screen % minus sealed screen %. Investigate if
  it exceeds 15 points, or if public rises while sealed stays flat for 3
  consecutive scoring runs.
- **Regression gate:** a commit range that lowers the sealed score by more than
  1 point is reviewed before more work lands on it.
- Track RNG % alongside, but don't gate on it. The judge treats it as advisory.

## Leakage policy

- **Burn and replace.** Once anyone pastes details of a sealed session (a diff,
  a seed, a screen) into an agent session, move that session to dev-private and
  generate a replacement with the same strata.
- **Rotation.** Every two weeks, replace a quarter of the sealed sessions with
  fresh draws. Keep 22 fixed "anchor" sessions so the trend line stays
  comparable.
- The agent may know the composition table above. It must never know the draws.

## Milestones

1. **Finish verifying the pipeline:** the short sessions are already checked
   (see above). Re-record one long session and create the holdout repo.
   *About 0.5 day.*
2. **Shared driver:** recorder process, screen parser and prompt classifier
   (`--More--`, y/n, direction, inventory letter, menu, text entry). *About 1–2 days.*
3. **Generators:** the grammar fuzz first (most coverage per hour), then 8–10
   scenario recipes, then the explorer bot. *About 3–4 days.*
4. **First sealed batch:** 88 sessions through validation, plus the scheduled
   Action and first baseline numbers. *About 1 day.*
5. **Dev-private stream:** the same generators with a different seed range, kept
   in this repo under `holdout-dev/`, which the agent may read. *About 0.5 day.*

## Decisions needed

1. Use a separate private repo with a GitHub Action (recommended), or a local
   directory you score yourself?
2. Which generator to build first: the grammar fuzz (fastest coverage), or the
   explorer bot (closest to the judges' planned harder sessions)?
3. Score on every push, or on a schedule (for example every 6 hours)? Scoring
   88 sessions takes several minutes, and Actions minutes are limited.
