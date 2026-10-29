# C and JavaScript semantics

| Difference | Port rule and audit result |
| --- | --- |
| Unstable library sort | Apple libc `qsort()` can reorder equal keys, but recorder patch `002-deterministic-qsort.patch` replaces game calls with `nh_deterministic_qsort()`. Its final comparison is the original array index, so equal keys retain input order. JavaScript's stable `Array.sort()` matches this rule; an Apple-specific `cQsort()` would change the pinned recorder's behavior. |

The native boundary is `include/hack.h:1570` and
`src/hacklib.c:19-70` in `nethack-c/recorder/`. The wrapper sorts an index
array with libc, breaks comparator ties by original index, then copies the
elements into that order. Only its internal index sort reaches libc directly.
The patch and `nethack-c/README.md` both document this stable ordering.

## Native call-site audit

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
| `wizcmds.c:list_migrating_mons` (1584) | `migrsort_cmp`: destination dungeon, level, then monster ID | No; monster IDs are unique. Wizard-only path excluded. | `wizard_migration.ts:listMigratingMonsters`: `Array.sort` by destination and monster ID. |

## Host measurement and the ration menu

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
