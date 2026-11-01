# C behavior JavaScript does not reproduce by default

A faithful port must reproduce what the recorder binary actually did, and
in a few classes of C behavior JavaScript's default semantics give a
different answer. Each class below needs a deliberate alternative in
TypeScript, or a documented decision that the game cannot reach it.

The recorder is the pinned C built by `fresh-batches.yml` on `macos-latest`
(arm64, clang, LP64, Apple libc). Where C leaves behavior to the
implementation, that build is the reference. The recorder patches in
`nethack-c/patches/` replace some platform behavior with deterministic
versions, such as the runtime and `qsort()`. The patched behavior is the
one to match.

| Class | C behavior | JavaScript default | Alternative in the port | Status |
|---|---|---|---|---|
| Fixed-width integers | `int`, `long`, `schar`, `uchar`, `coordxy` (`int16_t`), and unsigned types wrap or truncate on overflow and narrowing | Doubles: no wrap, exact to 2^53 | Narrow explicitly where C narrows (`\| 0`, `<< 24 >> 24`, `& 0xff`, `Math.imul`). `isaac64` uses BigInt with 64-bit masks. | The proofs in `docs/formal-verification.md` make overflow a proof obligation. Known out-of-domain divergences: `rnz` above about 1.07e8 (`long` to `int`), `distmin`/`dist2` outside ±16384; wizard-glob nutrition narrowing (below) |
| Undefined behavior | `x % 0`, signed overflow, `abs(INT_MIN)`: the result is whatever the compiler and CPU did | Defined: `NaN`, exact values, or the port returns 0 | Treat each as a domain fact. Prove that callers stay inside the domain, and only otherwise emulate the arm64 result. | `rn2(0)` and similar: C consumes a draw, the port does not. No corpus session reaches it. Callers are checked by `verification/callsites/`; 202 sites remain unproved |
| Library sort | Plain libc `qsort()` is not stable, but the recorder patch `002-deterministic-qsort.patch` turns every game `qsort()` into `nh_deterministic_qsort()`, which breaks comparator ties by original index | `Array.prototype.sort` is stable, which matches the patched rule | Sort the same input order with the same comparator. Never emulate libc's unstable order. | Matches by construction. A port sort can still differ through its comparator or its input order |
| Shared storage | `union`s and `obj.h` field aliases (`opoisoned`=`otrapped`, `orotten`=`oeroded`, `leashmon`=`corpsenm`, and others): writing one name changes the other | Separate fields | Every C test, copy, or reset of the base field also covers each alias that applies. The full list is in the unit brief and `obj.h`. | Ongoing; past mergeability and erosion bugs came from this |
| Rotating static buffers | `xname()`/`doname()` return one of `NUMOBUF` (12) static buffers, and other helpers return a single static buffer. A message that formats more names than that overwrites earlier ones, and a saved pointer changes later. | Strings are values | Not modeled. It matters only if a single message formats more than 12 object names, or code keeps a returned buffer across another call. | No known case |
| Fixed buffer lengths | `BUFSZ` (256), `PL_NSIZ`, and `QBUFSZ` truncate names, engravings, and prompts. `Strcpy` into a smaller buffer truncates or corrupts it. | Unlimited | Truncate where C's buffer limits text the player can see or the game stores | Audit by message class when sessions show long text |
| Freed or uninitialized memory | Reading a freed object or an uninitialized field gives allocator-dependent bytes | The old object stays alive, or the field is `undefined` | C avoids this in reachable code. A port that depends on such a read reproduces the C order of free and use instead. | None known in the game. The recorder had one (see below) |
| Synchronous input | `nhgetch()` blocks inside any function | Waiting for a key needs `async`/`await` through the whole call chain | Every function that can reach input is async and awaited. `no-floating-promises` and `no-misused-promises` are lint errors. | Enforced by `npm run compile` |
| Process-lifetime statics | `static` locals and file-level globals persist for the process and reset only at `dealloc` or restart | Module state persists across games in the same page | Keep game state in `GameState`. Every field is classified as persistent or transient, which `AGENTS.md` enforces at compile time. | Enforced by the schema |
| Operating-system features | Mail delivery (`MAIL`, polled every `MAILCKFREQ`=50 moves from the mailbox file), `MSGHANDLER` fork and exec, data-file seek errors, terminal size checks for `perm_invent`, bones and save file I/O, `getenv`, uid | No processes or filesystem in the grader | Port only the effects a recording can show. With no mailbox and no handler, the mail and handler paths do nothing and draw no random numbers. | `md_rush` and `execplinehandler` texts are listed by `static-gaps` but out of scope |
| Wall clock | `getnow()` sets the moon phase, Friday the 13th, `night()`, and `midnight()`, and the recorder's fixed date inherits the current New York daylight-saving offset | No clock in the replay | Take the recorded datetime from the session, and apply C's local-time conversion, DST included | Preamble, moon, and restored-birthday mismatches have been real |

## Fixed-width integers: wizard-glob weight override

Known divergence: `objnam.c:readobjnam` permits a wizard to override its glob
weight limit. Wishing for `107374336 small globs of brown pudding` and
accepting that override produces unsigned weight/nutrition `2147486720`.
`eat.c:obj_nutrition` returns that weight; `eat.c:doeat:3050` narrows it to
signed `int` `-2147480576`, passed as the denominator at `eat.c:doeat:3058`.
The zero-denominator guard does not reject a negative value.

The emitted port already differs earlier: the native meal delay is `33554483`,
while `corpse_meal.js:prepareCorpseMeal` uses a signed right shift and yields
`-33554381`. The negative denominator also lies outside the proved positive
`rounddiv` domain. This construction requires the wizard-mode weight override;
ordinary wishes retain the glob-count cap. No game fix is included.

`verification/equivalence/rounddiv_witness.py` evaluates the real clang and
emitted JavaScript AST expressions and checks native arithmetic obligations.
The complete wish/eating path was source-audited, not replayed. See
[the caller audit](formal-verification.md#all-rounddiv-callers-and-the-negative-denominator-gap)
for all six native call sites and corresponding port calculations.

## Library sort: the recorder wrapper and every call site

The native boundary is `include/hack.h:1570` and
`src/hacklib.c:19-70` in `nethack-c/recorder/`. The wrapper sorts an index
array with libc, breaks comparator ties by original index, then copies the
elements into that order. Only its internal index sort reaches libc directly.
The patch and `nethack-c/README.md` both document this stable ordering.

### Call-site audit

The supplied source has 18 `qsort` call expressions in 13 C files after
comments are removed: 16 active game or utility calls, the wrapper's libc
call, and one obsolete implementation inside `#if 0`. Comment examples and
mentions are not additional calls. The tie column describes the original
comparator; the recorder wrapper breaks any such tie by input index.
File, option-menu, and wizard-only paths are listed but excluded from
gameplay changes.

| C call site | Comparator and final ordering | Can distinct elements tie? | TypeScript counterpart and sort |
| --- | --- | --- | --- |
| `botl.c:condopt` (1320) | `cond_cmp`: condition rank, then case-insensitive option name | No; option names are unique. | `status_conditions.ts:statusConditions`: `Array.sort` by rank and option name. |
| `botl.c:cond_menu` (1395) | `cond_cmp` or `menualpha_cmp`: rank/name or name alone | No; option names are unique. Option-menu path excluded. | `option_editors.ts:editStatusConditions`: `Array.sort` by optional rank and name. |
| `files.c:get_saved_games` (1529) | `strcmp_wrap`: saved character name | Only equal name strings; file-selection path excluded. | No filesystem save-list sort; the port restores through its storage backend. |
| `getpos.c:gather_locs` (550) | `cmp_coord_distu`: Chebyshev distance, then y, then x | No; each map coordinate is collected once. | `getpos.ts:gatherValidLocations`: `Array.sort` by the same three keys, shared by target cycling and target menus. |
| `hack.c:notice_all_mons` (1774) | `notice_mons_cmp`: squared distance from hero | Yes; monsters on different squares can have equal distance. The wrapper retains `fmon` order. | The accessibility monster-notice feature has no counterpart yet. No current port sort to replace. |
| `hack.c:dump_weights` (4468) | `cmp_weights`: formatted weight and name string | Equal complete strings only; command-line data dump excluded. | No counterpart. |
| `hacklib.c:nh_deterministic_qsort` (62) | `nh_qsort_idx_cmp`: caller's comparison, then original index | No; each index is unique. This is the only direct libc call. | Stable `Array.sort` preserves equal-key input order without a separate helper. |
| `insight.c:list_vanquished` (2867) | `vanqsort_cmp`: selected level, difficulty, name, class, or count keys; finally monster index | No; each species occurs once and the final index is unique. | `end.ts:vanquishedEntries` / `vanqsortCompare`: `Array.sort` with the same final monster-index key. |
| `insight.c:list_genocided` (3065) | `vanqsort_cmp`; count modes are changed to alphabetical for this list | No; same unique species-index tie-breaker. | `end.ts:genocidedLines`: `Array.sort` through `vanqsortCompare`. |
| `invent.c:sortloot` (635) | `sortloot_cmp`: requested in-use, class, inventory-letter, name, and condition keys; finally original chain index | No; retained objects receive distinct indices. Equal rations cannot expose libc tie order. | `object_sort.ts:sortObjects` / `compareLoot`: `Array.sort` with final input index. The erosion comparison includes the separate `orotten`, `odiluted`, and `norevive` fields that alias C's erosion fields. |
| `invent.c:sortloot` (680) | Same comparator in obsolete linked-chain implementation | Unreachable: inside `#if 0`. | No counterpart needed. |
| `makemon.c:init_mongen_order` (1824) | `cmp_init_mongen_order`: monster class packed with difficulty | Yes; different species can share class and difficulty. The wrapper retains monster-index order, which affects `mkclass` selection. | `mklev.ts:monsterGenerationOrder`: `Array.sort` by packed class/difficulty, then monster index; input is already in index order. |
| `mklev.c:sort_rooms` (215) | `mkroom_cmp`: room's left x coordinate | Yes; vertically separated rooms can share their left edge. The wrapper retains creation order, affecting corridor joins and later room processing. | `mklev.ts:sort_rooms`: stable `Array.sort` by `lx`, then remaps room numbers. |
| `o_init.c:disco_output_sorted` (749) | `discovered_cmp`: case-insensitive formatted line after its two-character encounter marker | Yes; distinct undiscovered bag types can both display as `bag`, or share a called name. The wrapper retains discovery order. | `o_init.ts:discoveryRows` / `classDiscoveries`: stable `Array.sort` by classification when requested, then `compareDiscoveryNames`. |
| `o_init.c:doclassdisco` (1108) | `discovered_cmp`, as above | Yes; the same equal-name case within one class. | `o_init.ts:classDiscoveries`: the same stable sort. |
| `shk.c:make_itemized_bill` (1661) | `sortbill_cmp`: used-up first, descending cost, then bill index | Yes; separate hero-owned containers with equally priced unpaid contents both have bill index -1. Ordinary bill indices distinguish other entries; used/intact halves sort separately. The wrapper retains bill traversal order for equal container entries. | `shop_payment.ts:itemizedShopBill`: stable `Array.sort` by used status, price, and bill index. |
| `spell.c:sortspells` (1969) | `spell_cmp`: casting slot, or selected level/skill keys followed by case-insensitive spell name | No in normal play; each learned spell type appears once and spell names are distinct. Maintain-current mode returns before sorting. | `spell_menu.ts:compareSpells`: `Array.sort` by the same keys; maintain-current bypasses sorting. |
| `wizcmds.c:list_migrating_mons` (1584) | `migrsort_cmp`: destination dungeon, level, then monster ID | No; monster IDs are unique. Wizard-only path excluded. | `wizcmds.ts:listMigratingMonsters`: `Array.sort` by destination and monster ID. |

### Host measurement and the ration menu

A temporary C harness in `.cache/qsort-ties.c` calls this arm64 Mac's libc
directly. It prints permutations for lengths 1 through 64, eight patterns
(all equal, alternating, modulo three, reverse modulo three, ascending and
descending groups of four, an organ-pipe pattern, and modulo seven), and
8- and 64-byte elements. Of 1,024 cases, 904 reorder equal keys. The first
is eight equal elements, whose original indices become
`[7, 1, 2, 3, 4, 5, 6, 0]`. Adding the original-index tie-breaker preserves
equal-key order in every case. These measurements describe libc, not the
patched game's effective ordering. The harness and output stay uncommitted.

The ration menu discrepancy comes from `invent.c:sortloot_cmp`'s
`greatest_erosion()` comparison before the chain-index tie-breaker.
`obj.h` stores `orotten` and `odiluted` in `oeroded`, and `norevive` in
`oeroded2`. TypeScript keeps these as separate fields. Comparing only
`oeroded` and `oeroded2` incorrectly treats fresh and rotten rations as
equal and falls through to chain order. Including all three aliases gives
the native fresh-before-rotten order while preserving chain order for
genuinely equal rations. The same rule orders undiluted potions before
diluted ones and revivable corpses before nonreviving ones when earlier
keys match.

Behavior tests in `object_sort.test.ts` cover all three aliases.
`loot_menu_partly_eaten_order.test.ts` covers both insertion orders in the
actual take-out menu, alongside the existing equal-condition chain-order
cases. No libc permutation fixtures or custom sort implementation are
needed for the pinned recorder.

## Recording artifacts, not game behavior

Some differences come from the recorder harness rather than the C game, and
the port must not imitate them. `win/tty/termcap.c:nomux_capture_screen()`
writes into `static char nomux_out[24 * 256]` without a bounds check. A
`#terrain` full-map screen of 6,256 bytes overflowed it, so the cursor
reports and final screens of session 34cf457b are corrupt from that step on.
Fix it in `nethack-c/patches/006-nomux-capture.patch` and re-record; the
port is not at fault.

## Static-gap reports: what is not a missing branch

`node scripts/static-gaps.mjs` (`docs/oracles.md`) lists leads, not
verdicts. Audits of its message and edge reports found these classes of
false alarm:

- **Composed messages.** The port builds many C literals from template
  pieces, verb tables, or helpers (`` `${subject} shoots out at you!` ``,
  `` `produces a ${familiar ? 'familiar, ' : ''}lilting melody` ``). The
  fixed piece of the C literal then appears nowhere verbatim. In the first
  two message units (`msg-items-env`, `msg-melee`), most leads were of this
  kind. Each unit still found one real fix next to its leads:
  iron footwear named in the spiked-pit message, and miss messages anchored
  at the attacker for `accessiblemsg`.
- **Dead C branches.** Some literals cannot be printed by the pinned C:
  - `gazemu` "doesn't look all that ugly": `react` is −1 before the test.
  - `lava_effects` " and are about to be immolated": the branch only runs
    with fire resistance.
  - `potion_dip` "Something happens.": the buffer is always filled.
  - `priest_talk` "Begone! Thou desecratest...": `inhistemple()` already
    requires a shrine.
- **Individually verified unsupported or unreachable paths.** Mail delivery
  and the message-handler fork (operating-system features, above), and
  `show_spells` "You didn't know any spells.", which only the end-of-game
  dump reaches. Wizard-mode commands, option menus, and status-highlight
  menus are **not** out of scope. The port implements and tests several of
  them (`#wizwish`, `#optionsfull`), so their leads are audited like any
  other. Exclude a feature only after checking it individually, and record
  why.
- **Diagnostics.** Literals that are only function or file names passed to
  `impossible()`, `debugpline()`, or sanity checks (`"mhitm_knockback"`,
  `"src/artifact.c"`), and `mv_bubble`/`shkinit` debug output.
- **Recorder instrumentation in the edge report.** When `static-gaps` reads
  the patched `nethack-c/recorder` tree, the RNG-log hooks
  (`rng_log_enabled`, `rng_log_set_caller`) appear as missing callees of
  almost every function. CI reads `nethack-c/upstream`, which has no hooks.
  Run locally with `NETHACK_SOURCE=nethack-c/upstream` to compare like with
  like.
- **Renamed, inlined, or restructured helpers in the edge report.** For
  example, `acurr()` becomes an attribute accessor and `rn2` becomes an
  injected `random`. `nh_timeout()` (54 of 56 edges missing) and
  `mcast_spell()` (20 of 20) are mostly restructured, not missing. They
  shrink as `docs/ledger/c-ts-aliases.tsv` grows.

Record audited message verdicts in `docs/ledger/c-messages-reviewed.tsv`,
using the same `file`, `owner`, and escaped `piece` keys as `c-messages.tsv`,
followed by a verdict and a concrete reason. Reviewed keys leave the missing
list; `--verbose` shows their reasons. The stale check reports vanished C
keys and missing composed-message files, function definitions, or lines, and
fails `static-gaps messages --check-ledger docs/ledger/c-messages.tsv`.
Existing references still require human review when their behavior changes.
