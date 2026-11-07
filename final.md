# fix-pethit-5563 — hero melee hit on a pet stops early

## Root cause (C evidence)

Session `5563237b-89e8-4dcf-a753-4efff5e01431` first diverged at step 370
(before: rng 28465/30007, screens 370/451). C's step 370 (`h`, bare-handed
attack on the hero's unseen pet cat):

    rnd(20)=14  @ hitum(uhitm.c:780)                 dieroll
    rnd(2)=1    @ hmon_hitmon_barehands(uhitm.c:847) damage
    rn2(9)=3    @ abuse_dog(dog.c:1381)              yelp check -> "It yowls!"
    rnd(1)=1    @ hmon_hitmon_pet(uhitm.c:1599)      monflee(10*rnd(dmg))
    rn2(25)=18  @ known_hitum(uhitm.c:625)           still-alive flee check
    rn2(3)=1    @ passive(uhitm.c:6019)              + 85 more calls (turn tail)

The port drew through `rnd(1)=1` and then ended the whole step with a pending
`--More--`; its top line was "You begin bashing monsters with your bare
hands.  It yowls!--More--" while C had only "It yowls!  You hit it.".

The extra message is the bug. At step 347 the hero broke a *wielded* wand of
fire. C `do_break_wand()` (apply.c:3946-3948) unwields it with

    gc.current_wand = obj;
    freeinv(obj);
    setnotworn(obj);    /* so we need to do this ourselves */

`setnotworn()` (worn.c:150) clears every worn slot but never touches
`gu.unweapon`. The port called `removeWornHeroItem` — the port of steal.c
`remove_worn_item()` — whose W_WEAPONS branch (steal.c:262) routes a wielded
object through `uwepgone()`, which arms `state._unweapon = true`
(wield.c:882 in C). The hero's next bare-handed attack (step 370) then
printed the "You begin bashing monsters with your bare hands." notice that C
does not print; the combined top line forced a `--More--` boundary, the step
ended awaiting input after `rnd(1)`, and `rn2(25) @ known_hitum` plus the
whole turn tail never ran.

## Fix

`src/js/apply.ts` `breakWand()`: replace the `removeWornHeroItem(wand,
state)` call after `freeInventoryObject` with `setnotworn(wand, state)` —
the same worn.c function C uses, which already exists in `src/js/worn.ts`
(zap.ts's `maybe_destroy_item` port already uses that route). One-line
semantic change; no other behavior touched.

## Test

`src/test/weapon_readiness.test.ts`: "breaking a wielded wand does not
announce bare-handed combat on the next attack" — wields a wand of nothing,
attacks once (notice printed and consumed), breaks the wielded wand via the
public apply command (`a` + confirm), then asserts the wield slot is empty
and that the next two bare-handed attacks never print "You begin bashing".
Fails before the fix (extra bare-hands notice), passes after.

## Verification

- `npm run compile` — pass; `npm run check` — pass.
- `node --test --test-timeout=60000 test/weapon_readiness.test.js`: 17/17
  pass (16/17 before the fix, the new test failing).
- Related suites: wand_break 35/35, wand_break_exclusion 1/1,
  wand_shuffled_breakage 2/2, apply_death_causes 5/5, object_bypass 9/9,
  explosion 24/24.
- Example session after: **passed** — rng 30007/30007, screens 451/451,
  cellsOnly 451/451, cursors 451/451 (before: rng 28465/30007,
  screens 370/451, first divergence step 370).
- Public sessions: 43/44 passed; the only failure is the pre-existing
  `seed2200-wizard-quaff-zap-read` (`grep -o '"passed":false' | wc -l` = 1).
- static-gaps ledgers (with `NETHACK_SOURCE=<main>/nethack-c/recorder`):
  messages, edges, args, constants all hold ("every listed row still
  holds"); owners holds against `docs/ledger/module-owners.tsv` (there is
  no c-owners.tsv in this tree).
- rng-callsites `verification/callsites/check.py --check-ledger
  docs/ledger/rng-callsites.tsv`: **0 regressions** (2459 sites: constant
  2060, unproved 329, invariant 61, guarded 9 — pre-existing profile).
- Full `npm test`: exit 0 — tests 17500, pass 17498, fail 0, todo 2
  (the two known TODO recipes `#lightsources` and `#stats`).

## Open gaps noticed, not fixed

- The `--More--` that ended the step after `rnd(1)` was purely a consequence
  of the extra message; no separate pager defect.
- `gu.unweapon` parity is only spot-checked; other `uwepgone()` /
  `setuwep(NULL)` sites in the port were not audited beyond the traced ones
  (drop, wield, uwepgone via wand break, mount/dismount polearms, towel).
