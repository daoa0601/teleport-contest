Completed the text-gaps1 audit on branch `daoa/text-gaps1`.

All 396 supplied rows were classified, including the three repeated input rows. The gameplay “other text” count fell from **549 to 0**. Printed gameplay messages remain at **0 unreviewed**. The counts come from the original implementation with the original reviewed ledger, and the final implementation with the completed reviewed ledger, using `NETHACK_SOURCE=/Users/anhdao/project/contest/nethack-c/upstream`.

| Supplied-row verdict | Count |
| --- | ---: |
| Composed | 64 |
| Diagnostic | 260 |
| Out of scope | 47 |
| Dead | 18 |
| Missing, now fixed | 7 |
| Total | 396 |

The reviewed ledger adds 481 keys and retains every existing key and reason. Its final 625 entries contain 173 composed, 361 diagnostic, 50 out-of-scope, and 41 dead verdicts. The six fixed literals now present verbatim need no exception; the composed partial-sale literal has a reviewed entry. Infrastructure still has 34 unreviewed printed literals and 363 other-text literals, outside this gameplay audit.

The continued draft needed two stale data-table citations changed to real function citations. Composed citations were checked with `rg`, including the actual text fragments and their callers. Lua des errors are diagnostics: the port does execute Lua, contrary to the draft's original reasons. Native save-field labels are diagnostic metadata. Both `docontact()` local-support variants are dead in the pinned configuration: SUPPORT is unset, and WIZARDS=* prevents `cnf_line_WIZARDS()` from building `fmtd_wizard_list`. The `getpos_help()` coordinate hints are also dead text: C overwrites their buffer without displaying it.

| Native behavior ported | Missing literals | Behavior coverage |
| --- | ---: | --- |
| `cmd.c:handler_change_autocompletions()`, `count_autocompletions()`, `parseautocomplete()`; `options.c:optfn_o_autocomplete()` | 1 | The editor retains cancellation, applies selections, displays changed-command markers and counts, and changes command completion. |
| `insight.c:vanqorders`; `options.c:optfn_sortvanquished()` | 4 | Configuration selects all native modes; the options menu displays the current short description; its editor uses the existing sort menu and reports changes. |
| `shk.c:sellobj()` | 1 | An explicit sale of mixed-ownership contents uses the native “sold some items inside” receipt, including the message pager. |
| `wizcmds.c:wiz_flip_level()`; `sp_lev.c:flip_level()`, `flip_level_rnd()`, direction and display helpers; `worm.c:flip_worm_segs_*()` | 1 | The command prompts, cancels or flips without taking time. The shared flip handles the live hero, punishment placement, objects, buried objects, monster goals and role data, worm segments, pits, drawbridges, regions, timers, remembered walls and vision. |

The proposed death reasons (`contaminated tap water`, `propelled potion`, and the self-inflicted death ray), sink-dipping prompt, iron-bar resume prompt, and container disarm descriptions were already composed correctly. Their source paths were verified; they did not require a gameplay change.

Ten behavior cases were added in `src/test/options_other_settings.test.ts` (4), `src/test/shop_sell.test.ts` (1), and `src/test/wizard_flip_level.test.ts` (5). Compiling the original implementation with these new tests produced **0/10 passing**, with observable completion, text, or game-state failures. Final focused verification passed **205/205**, across those three files plus `vanquished_sort_menu`, `extended_command_editor`, `options_parse_errors`, `options_interactive`, `sokoban_levels`, and `lua_special_location`.

Verification results:

- `npm run compile`: exit 0, including strict type checking and type-safety lint.
- Focused tests with `--test-timeout=60000`: 205 passed, 0 failed, 0 cancelled.
- `static-gaps.mjs messages --check-ledger docs/ledger/c-messages.tsv`: exit 0; gameplay text 549 → 0; no stale reviews or lost listed messages.
- The corresponding constants and edges ledger checks: both exit 0; no listed constant or edge lost.
- Full suite, public/eval/pool/fresh corpus runs and verified-function ledger checks were not run locally, following the unit's explicit machine-safety restriction. Those integration gates remain for CI and the orchestrator.

No example session paths were supplied. Two public sessions were replayed individually as supplemental diagnostics:

| Session | Before: RNG / screens | After: RNG / screens | First RNG / screen difference, before → after |
| --- | --- | --- | --- |
| `seed0106-priest-extcmd-sweep` | 4,194/4,194; 267/267 | 4,194/4,194; 267/267 | none / none → none / none |
| `seed0700-samurai-explore-descend` | 3,230/3,230; 51/51 | 3,230/3,230; 51/51 | none / none → none / none |

No unclassified or missing gameplay literal remains in the supplied audit. The native `#wizfliplevel` limitations described in C's own comment remain: it does not repair level arrival regions, monster tracking history, or migrating-monster destination coordinates. These are native limitations, not additional port behavior.

Code commits: `92aa3d4f` (option editors), `1b1822d7` (partial sales), and `e8703dfc` (active level flips). The ledger and this report are committed separately. No push, merge, native-source modification, or corpus recording was performed.
