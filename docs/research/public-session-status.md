# Public session status: movement-ration checkpoint

Measured 2026-07-19 15:37 EEST from the working tree based on `a783285` with:

```sh
TELEPORT_DISABLE_FIXTURES=1 node frozen/ps_test_runner.mjs sessions
```

Top-level exact-session fixtures are disabled. Some passing paths still use
older bounded, state-derived bridges; `Exact` therefore means “current
engine-only regression passes,” not “the corresponding subsystem is complete
for unseen inputs.” The current result is **25/44 exact**. Fixture-on public
scoring remains 44/44.

| Public session | Engine-only result | Current interpretation / next cone |
| --- | ---: | --- |
| `seed0002-healer-reflection-drummer` | 2,336/27,158 RNG; 8/595 screens | Broad elapsed-turn combat, reflection/drumming, and animation; start with shared monster scheduler |
| `seed0004-feeding-pony` | 3,718/12,084; 10/409 | Movement allocation and first quiet actor schedule now align; next exact-prefix blocker is pet-object handling inside `dog_move` |
| `seed0006-wizard-water-demon` | 2,525/6,736; 38/123 | First kitten/zombie/rat actor schedule now aligns; next exact-prefix blocker is command/elapsed-turn ordering before combat |
| `seed0007-rogue-snake-swamp` | 69/16,373; 8/302 | Early random chargen/level branch, then swamp and monster behavior; re-audit earliest call |
| `seed0009-swimmer-mforce` | 3,337/3,713; 12/73 | Startup mostly aligned; swimmer/mysterious-force command and transition tail |
| `seed0012-monk-vault-escort` | 0/13,878; 0/308; input queue error | Water-surrounded vault content plus nested input/escort behavior |
| `seed0013-friday13-save-then-fullmoon-restore` | **Exact** 4,804; 99 screens | Save/restore regression witness |
| `seed0013-rogue-friday13-combat` | **Exact** 4,838; 59 | Themed-room/calendar/combat regression witness |
| `seed0014-dequa-fountain-explore` | 2,963/59,178; 10/714 | Fountain events and long monster/turn scheduler |
| `seed0015-valk-level2-pit-dog-wait` | **Exact** 8,563; 44 | Level-two/pit/dog bounded regression witness |
| `seed0016-healer-newmoon-eat-zap` | **Exact** 3,656; 36 | Healer startup/sleep-wake regression witness |
| `seed0017-samurai-altar-pray` | **Exact** 3,465; 67 | Samurai/prayer regression witness |
| `seed0030-ten-diverse-deaths` | 6,413/105,529; 11/1,953 | Multi-role death/endgame breadth; defer until shared scheduler/transition/death cones exist |
| `seed0060-orc-rogue-kick-search` | **Exact** 3,626; 41 | Orc Rogue/startup/kick regression witness |
| `seed0077-rogue-chargen` | **Exact** 3,242; 33 | Manual chargen regression witness |
| `seed0101-ranger-quiver-throw-travel-engrave` | **Exact** 2,371; 27 | Ranger command regression witness |
| `seed0102-ranger-name-cancel` | **Exact** 4,485; 25 | Ranger generation/name/fire regression witness |
| `seed0103-knight-ride-pony` | **Exact** 2,640; 60 | Knight riding regression witness |
| `seed0104-knight-ride-combat` | **Exact** 3,223; 43 | Mounted combat regression witness |
| `seed0105-valk-chat-lamp-ration` | **Exact** 2,499; 30 | Valkyrie startup/chat regression witness |
| `seed0106-priest-extcmd-sweep` | **Exact** 4,194; 267 | Priest extended-command regression witness |
| `seed0107-samurai-twoweapon-enhance` | **Exact** 2,902; 98 | Samurai two-weapon regression witness |
| `seed0108-wizard-extcmd-wishlist` | 2,678/16,958; 0/303 | Extended command breadth plus later turn/transition behavior |
| `seed0116-wizard-wear-shop` | 2,980/12,562; 3/127 | First ordinary level transition; `goto_level` → `getbones` ordering |
| `seed0200-monk-north-search` | **Exact** 3,822; 40 | Monk/static-map/search regression witness |
| `seed0360-wizard-world-tour` | 2,815/120,639; 0/833 | Debug level teleport, special-level generation, arrivals |
| `seed0361-archeologist-tour` | 2,979/53,865; 40/366 | `#levelchange` exact; next debug level teleport/special generation |
| `seed0367-priest-quest-tour` | 1,909/50,125; 1/324 | Quest generation/transition and world-tour breadth; re-audit earliest call |
| `seed0373-barbarian-quest-tour` | 2,549/35,386; 1/124 | `#levelchange` exact; next `#wizlevelport` |
| `seed0383-wizard-hallucinate` | 2,491/16,915; 31/219 | Hallucination state plus ordinary turn/monster behavior |
| `seed0398-wizard-wandpoly-pile` | **Exact** 3,026; 87 | Wish/polymorph regression witness |
| `seed0399-wizard-hallu-actions` | 1,204/11,409; 0/532 | Early startup/generation audit, then hallucination action breadth |
| `seed0501-priest-cast-read-turn` | **Exact** 2,238; 28 | Priest spell regression witness |
| `seed0700-samurai-explore-descend` | **Exact** 3,230; 51 | Samurai exploration/descent regression witness |
| `seed0900-tourist-explore-actions` | **Exact** 2,983; 84 | Tourist actions regression witness |
| `seed1150-caveman-explore-move` | **Exact** 3,137; 51 | Caveman startup/commands regression witness |
| `seed1500-rogue-explore-move` | **Exact** 2,768; 40 | Rogue exploration regression witness |
| `seed1800-tourist-eat-throw` | **Exact** 2,458; 26 | Tourist eat/throw regression witness |
| `seed2200-wizard-quaff-zap-read` | **Exact** 3,018; 230 | Wizard item-command regression witness |
| `seed2600-wizard-custom-binds` | **Exact** 11,647; 38 | Custom binding/debug regression witness |
| `seed4500-knight-coverage` | 2,809/108,275; 3/1,814 | Broad ordinary turn/monster/command coverage; downstream of scheduler |
| `seed5002-wizard-coverage-pair` | 2,493/12,167; 2/410 | Broad Wizard commands, turns, and transitions |
| `seed5006-tourist-stress-disaster` | 4,190/13,923; 2/249 | First ordinary level transition; `goto_level`/bones, then disaster behavior |
| `seed8000-tourist-starter` | **Exact** 3,130; 23 | Startup/tty baseline regression witness |

## Priority clusters

1. **Monster movement and tame AI:** `0002`, `0004`, `0006`, `0014`,
   `0383`, `4500`, and later parts of `5002`.
2. **Ordinary level transitions and bones:** `0116`, `5006`, and likely the
   tail of `0009`.
3. **Themed content:** `0012` Water-surrounded vault.
4. **Debug/special/quest levels:** `0360`, `0361`, `0367`, `0373`.
5. **Independent early audits:** `0007`, `0399`; do not assign them to a
   downstream cone until their first exact RNG mismatch is re-measured.
6. **Breadth regressions:** `0030`, `0108`, `4500`, `5002`; use after shared
   dependency cones land, not as the first implementation targets.
