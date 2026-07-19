# Held-out parity debugging ledger

This is the compact blocker ledger. The append-only decision history is in
[`docs/research/journal.md`](research/journal.md), the fresh 44-session
engine-only matrix is in
[`docs/research/public-session-status.md`](research/public-session-status.md),
and the original C/Lua dependency maps are in
[`docs/architecture/original-c-lua-map.md`](architecture/original-c-lua-map.md).

## Contract

The judge compares two positional streams for each session:

1. every core PRNG call (`rn2`, `rnd`, `d`, and related wrappers), including
   its argument and result;
2. the rendered 80x24 terminal grid and cursor at every input boundary.

An exact session requires both streams to match completely. Public-session
fixture dispatch can prove that the scorer and serializer work, but it cannot
provide evidence about an unseen session. Use the real-engine diagnostic mode:

```sh
TELEPORT_DISABLE_FIXTURES=1 node frozen/ps_test_runner.mjs sessions
```

Baseline after the July 19 parity pass: **25/44 exact real-engine sessions**.
The public leaderboard showed **43 + 0 exact sessions** and **108 held-out
points**, so the hidden failure is structural rather than a submission or
scorer outage.

## Earliest-divergence portfolio

| Witness | Earliest real-engine divergence | Dependency cone | Current result |
| --- | --- | --- | --- |
| `seed0004` Knight | Second pony turn after the first global allocation | `dog_move` object/cursed-square handling (`obj_resists`) | Exact PRNG prefix now reaches 3,707, up from 3,696 |
| `seed0006` Wizard | Hero command immediately after the first kitten/zombie/rat round | `rhack` run/combat and elapsed-turn ordering | Exact PRNG prefix now reaches 2,523, up from 2,510 |
| `seed0116` Wizard | First ordinary level transition | `goto_level` -> bones lookup -> level creation | Diverges at `getbones` ordering |
| `seed5006` Tourist | First ordinary level transition | Same transition cone | Startup prefix reaches 4,182 |
| `seed0361` Archeologist | Debug world tour after level-up | `#levelchange`, then debug level teleport | All 19 level-ups now match; next divergence is later tour generation |
| `seed0373` Barbarian | Debug world tour after level-up | Same debug command cone | All 19 level-ups now match; next divergence is `wizlevelport` |
| arbitrary themed seed | Reservoir selects an unported room shape | Lua themed map placement and contents | All deterministic static shapes plus Blocked center are ported; Water-surrounded vault remains |

The two ordinary-play witnesses (`0004`, `0006`) are the minimal counterexample
to the previous strategy: a correct startup and command handler are not enough
when one elapsed turn enters an incomplete monster scheduler.

## Confirmed invariants

- Character selection uses C role order (Rogue precedes Ranger), legal
  role/race/gender/alignment completions, and the same random-choice draws.
- Archeologist and Barbarian use full role records, real inventory generation,
  pets, and level advancement data. Advancement records are now present for
  every role and race.
- Static themed maps are placed through one collision/topology path instead of
  seed-specific layouts. Blocked center preserves its 30% terrain replacement
  branch and RNG draw.
- `#levelchange` uses live HP/energy advancement, rank changes, intrinsic
  messages, and exact get-line cursor behavior. The two recorded level-20
  witnesses match every command boundary and PRNG call in that subsystem.
- Terminal capture serializes semantic cells, including DEC line drawing,
  ANSI style transitions, styled blanks, and cursor-forward gaps.
- Every monster now owns its source-derived natural speed and movement balance.
  Allocation and scan traverse reverse JS creation order to reproduce C's
  newest-first `fmon`; the seed0004 and seed0006 actor schedules are covered by
  focused tests.

## Falsified hypotheses

- **Held-out data is unavailable because the upload failed:** public held-out
  partial points disprove this.
- **Passing all public sessions means the engine generalizes:** exact fixture
  dispatch bypasses the real implementation for the long public sessions.
- **Knight seed 0004 is an inventory problem:** the first divergence was a
  missing rotated L-shaped level, then moved to the shared monster scheduler.
- **A single missing RNG call can be patched locally:** themed-room selection
  and monster scheduling change downstream state as well as the call stream.
- **The first held-out monster boundary lacked allocation calls:** both
  witnesses already had the exact `mcalcmove()` calls. Their results were being
  discarded, so actor ownership and scan order—not the draws—were missing.

## Next dependency cones

1. Extend the new movement-ration state beyond the first quiet round into the
   command loop, including fast/run/multi-action ordering.
2. Port the tame-animal object and candidate slice of `dog_move`, starting with
   `obj_resists()`/cursed squares in `seed0004`, then deriving `mfndpos()`
   candidates from live geometry. Do not encode recorded range lists.
3. Port ordinary `goto_level`/bones ordering and validate against `0116` and
   `5006`.
4. Treat Water-surrounded vault as a content subsystem: shuffled chest
   locations, guaranteed escape item, container initialization, and undead
   creation must land together.
5. Only after ordinary transitions work, port debug level-teleport menus and
   special-level generation used by the world-tour sessions.

## Regression gates

Run representative exact paths while iterating:

```sh
TELEPORT_DISABLE_FIXTURES=1 node frozen/ps_test_runner.mjs \
  sessions/seed0016-healer-newmoon-eat-zap.session.json \
  sessions/seed0077-rogue-chargen.session.json \
  sessions/seed0200-monk-north-search.session.json \
  sessions/seed8000-tourist-starter.session.json
```

Before publishing, run the full engine-only suite, then the normal fixture-on
suite. `frozen/score.sh` overwrites the terminal/storage overlays, so restore
those generated copies before committing.
