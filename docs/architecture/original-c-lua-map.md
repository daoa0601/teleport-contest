# Original NetHack C/Lua architecture map

This is the working architecture model for the pinned NetHack 5.0 source in
`nethack-c/upstream`. It is intentionally scoped to parity-critical paths: game
startup, themed level generation, input/turn scheduling, level transitions,
and wizard/debug level commands. It is not an exhaustive map of NetHack.

Source anchors use the current pinned tree:

- C lifecycle: `src/allmain.c`, `src/cmd.c`
- hero/role startup: `src/role.c`, `src/u_init.c`, `src/dungeon.c`,
  `src/artifact.c`, `src/dog.c`
- level generation: `src/mklev.c`, `src/sp_lev.c`, `src/nhlua.c`
- Lua: `dat/themerms.lua`, `dat/nhcore.lua`, and special-level `.lua` files
- monsters: `src/mon.c`, `src/monmove.c`, `src/dogmove.c`
- transitions: `src/do.c`, `src/bones.c`, `src/save.c`
- debug commands: `src/wizcmds.c`, `src/exper.c`, `src/teleport.c`

## 1. Runtime ownership map

```mermaid
flowchart LR
    entry["Program and window entry"] --> lifecycle["allmain.c<br/>newgame / moveloop"]

    subgraph startup["New-game construction"]
        role["role.c<br/>role_init"]
        dungeon["dungeon.c<br/>init_dungeons"]
        artifact["artifact.c<br/>init_artifacts"]
        hero["u_init.c<br/>u_init_misc / inventory / skills"]
        pet["dog.c<br/>makedog"]
    end

    subgraph levelgen["Level construction"]
        mklev["mklev.c<br/>mklev / makelevel / makerooms"]
        bones["bones.c<br/>getbones"]
        splev["sp_lev.c<br/>des.* Lua bridge"]
        levelstate["C level state<br/>levl / rooms / objects / monsters / stairs"]
    end

    subgraph lua["Lua runtimes"]
        nhcore["nhcore.lua<br/>persistent variables and callbacks"]
        themes["themerms.lua<br/>room reservoir and fills"]
        special["special-level Lua<br/>quest / Sokoban / bigroom / etc."]
    end

    subgraph turns["Commands and elapsed turns"]
        command["cmd.c<br/>parse / rhack / commands"]
        scheduler["allmain.c + mon.c<br/>movement rations / turn maintenance"]
        monmove["mon.c + monmove.c<br/>movemon / dochug / m_move"]
        dogmove["dogmove.c<br/>dog_move"]
        display["vision + display + tty<br/>next input boundary"]
    end

    subgraph transition["Level persistence and arrival"]
        goto["do.c<br/>goto_level"]
        savelev["save/load level state"]
        arrival["hero placement / followers / timers / messages"]
    end

    lifecycle --> role
    role --> dungeon --> artifact --> hero
    hero --> mklev
    mklev --> bones
    bones -->|"no usable bones"| mklev
    mklev --> themes
    themes --> splev
    special --> splev
    splev --> levelstate
    levelstate --> pet
    pet --> command

    lifecycle <--> nhcore
    command --> scheduler --> monmove
    monmove --> dogmove
    dogmove --> monmove
    monmove --> display --> command

    command -->|"stairs, trap, portal, level teleport"| goto
    goto --> savelev --> mklev
    mklev --> arrival --> display
```

The central architectural fact is that Lua does not own a parallel map. Lua
selects and describes content, while `sp_lev.c` immediately mutates the same C
level structures later consumed by stairs, corridors, occupancy, monster AI,
vision, save/restore, and tty rendering.

## 2. New-game startup sequence

```mermaid
sequenceDiagram
    participant Main as allmain.c:newgame
    participant Role as role.c / dungeon.c
    participant Hero as u_init.c
    participant LuaCore as nhlua.c + nhcore.lua
    participant Level as mklev.c
    participant Theme as themerms.lua + sp_lev.c
    participant Pet as dog.c
    participant UI as display / tty

    Main->>Main: init_objects()
    Main->>Role: role_init()
    Main->>Role: init_dungeons()
    Main->>Role: init_artifacts()
    Main->>Hero: u_init_misc()
    Main->>LuaCore: l_nhcore_init()
    Main->>Level: mklev()
    Level->>Level: reseed_random(); getbones()
    alt no usable bones level
        Level->>Level: makelevel()
        Level->>Theme: makerooms() / themerooms_generate()
        Theme->>Level: des.* mutates live C level state
        Level->>Level: corridors, stairs, fills, topology, mineralize
    else bones accepted
        Level->>Level: restore saved level structures
    end
    Main->>Main: u_on_upstairs(); vision_reset()
    Main->>Pet: makedog()
    Main->>Hero: u_init_inventory_attrs()
    Main->>UI: docrt(); bot(); optional reroll
    Main->>Hero: u_init_skills_discoveries()
    Main->>UI: legacy pager; welcome()
    Main->>LuaCore: nhcore.start_new_game
```

### Startup ordering invariants

1. `init_objects()` precedes role and inventory work.
2. `role_init()` precedes dungeon initialization and hero initialization.
3. Dungeon/artifact state exists before random inventory can request monsters,
   tins, eggs, or artifacts.
4. The level is fully generated before the hero is placed and the pet exists.
5. Inventory/attributes are finalized after pet creation and before the first
   playable input boundary.
6. Changing a draw or linked-list insertion anywhere in this sequence changes
   later level geometry, monster order, movement candidate counts, and screens.

## 3. C ↔ Lua themed-room bridge

```mermaid
sequenceDiagram
    participant C as mklev.c:makerooms
    participant VM as Lua VM
    participant Theme as dat/themerms.lua
    participant Bridge as sp_lev.c
    participant State as C level state

    C->>VM: nhl_init() and nhl_loadlua(themerms)
    C->>VM: pre_themerooms_generate()
    loop until enough rooms or repeated failure
        C->>VM: themerooms_generate()
        VM->>Theme: evaluate eligibility and frequency
        Theme->>Theme: reservoir sample with nh.rn2(total_frequency)
        Theme->>Bridge: des.room / des.map / des.region
        Bridge->>State: collision check and mutate terrain/topology
        alt themed map cannot be placed
            Bridge-->>C: gt.themeroom_failed = true
        else map placed
            Theme->>Bridge: des.object / monster / trap / door / replace_terrain
            Bridge->>State: create content in the same live structures
        end
    end
    C->>VM: post_themerooms_generate()
    C->>State: sort rooms, stairs, corridors, niches, fills, mineralize
```

### Why this bridge is parity-critical

- `themerooms_generate()` performs weighted reservoir sampling; eligibility and
  list order determine every selection draw.
- `lspo_map()` can retry placement up to 100 times. In themed-room mode it may
  not overwrite non-stone or existing room topology, and failure changes the
  outer room-generation loop.
- `des.map()`/`des.region()` change terrain and room connectivity;
  `des.object()`/`des.monster()` add constructors and linked-list order.
- The Water-surrounded vault is a content transaction, not just a six-by-six
  terrain stamp: it shuffles chest positions, creates a guaranteed escape item
  inside a chest, preserves material-dependent lock behavior, creates three
  more chests, shuffles undead, and adds a teleport exclusion.

## 4. Command and elapsed-turn loop

NetHack's command and scheduler phases straddle consecutive calls to
`moveloop_core()`. `rhack()` sets whether the command consumed time near the end
of one iteration; the next iteration spends that time before accepting another
command.

```mermaid
flowchart TD
    boundary["TTY input boundary"] --> parse["cmd.c: parse() / rhack()"]
    parse --> classify{"Did command set<br/>context.move?"}
    classify -->|"No: menu, cancel, look, pager"| redraw["vision/status/message updates"]
    redraw --> boundary

    classify -->|"Yes: time passed"| nextcore["next moveloop_core()"]
    nextcore --> spend["u.umovement -= NORMAL_SPEED"]
    spend --> scan["movemon(): scan fmon in linked-list order"]
    scan --> eligible{"monster movement<br/>>= NORMAL_SPEED?"}
    eligible -->|"No"| nextmon["next monster"]
    eligible -->|"Yes"| debit["debit movement ration"]
    debit --> dochug["dochug(): status, target, fear, items, attack/move"]
    dochug --> tame{"mtame?"}
    tame -->|"Yes"| dog["dog_move(): hunger, inventory, goal, mfndpos candidates"]
    tame -->|"No"| generic["m_move() / special action / attack"]
    dog --> post["post-move effects and display state"]
    generic --> post
    post --> nextmon
    nextmon --> round{"any actor can still move?"}
    round -->|"Yes"| scan
    round -->|"No"| allocate["new global turn: mcalcdistress; mcalcmove for every monster"]
    allocate --> randommon["maybe generate random monster"]
    randommon --> hero["u_calc_moveamt; increment moves"]
    hero --> maintenance["Lua turn callback; timeouts; regions; regen; teleport; hunger; etc."]
    maintenance --> scan
    scan -->|"hero has movement ration"| redraw
```

### Minimum coherent monster-movement port

The smallest useful slice spans several files and state owners:

1. `allmain.c`: debit hero movement and decide whether a new global turn is
   required.
2. `mon.c:mcalcmove()`: adjust slow/fast speed and randomly round to multiples
   of `NORMAL_SPEED`.
3. `mon.c:movemon()`: preserve `fmon` scan order, movement debits, removals, and
   deferred level change.
4. `monmove.c:dochug()`: preserve pre-move status RNG and targeting before
   selecting tame/generic movement.
5. `dogmove.c:dog_move()`: derive candidates from `mfndpos()`, live occupancy,
   objects, cursed squares, goals, hunger, and combat—not from a recorded range
   list.
6. vision/display: update actor positions, remembered terrain, messages, and
   the terminal before the next input capture.

Porting only step 5 cannot be correct because its inputs and its place in the
random stream are owned by steps 1–4.

## 5. Ordinary level transition

```mermaid
sequenceDiagram
    participant Cmd as command / movement
    participant Go as do.c:goto_level
    participant Store as level save/load
    participant Build as mklev.c
    participant Bones as bones.c:getbones
    participant Arrival as arrival pipeline
    participant UI as vision / display

    Cmd->>Go: stairs, fall, portal, or level teleport
    Go->>Go: validate destination and run Lua leave callbacks
    Go->>Store: rewrite/save/free current level
    Go->>Go: clear level-local contexts; keep followers; reset vision
    alt destination level does not exist
        Go->>Build: mklev()
        Build->>Bones: getbones()
        alt bones accepted
            Bones->>Build: restore level and entity structures
        else no bones
            Build->>Build: makelevel() and finalize topology
        end
    else destination already exists
        Go->>Store: getlev()
    end
    Go->>Arrival: place hero by stairs/portal/random spot
    Arrival->>Arrival: deliver objects/followers; timers; collisions; bubbles
    Arrival->>UI: reset vision, glyph map, and full screen
    Arrival->>Arrival: special/quest/branch messages and events
    Arrival->>Arrival: pickup, room checks, annotations
    Arrival-->>Cmd: return to command loop
```

Ordering is observable in both parity channels. For example, `mklev()` calls
`getbones()` before new generation; a different bones roll or file decision
changes the complete new-level RNG stream. Arrival ordering also changes which
messages and map cells are present at each input boundary.

## 6. Debug level-changing commands

```mermaid
flowchart LR
    ext["cmd.c extended-command dispatch"] --> levelchange["wizcmds.c:wiz_level_change"]
    levelchange --> parselevel["getlin and validation"]
    parselevel -->|"raise"| pluslvl["exper.c:pluslvl repeatedly"]
    parselevel -->|"lower"| losexp["exper.c:losexp repeatedly"]
    pluslvl --> stats["HP, energy, rank, intrinsics, messages"]
    losexp --> stats

    ext --> wizport["wizcmds.c:wiz_level_tele"]
    wizport --> leveltele["teleport.c:level_tele"]
    leveltele --> schedule["choose destination / schedule transition"]
    schedule --> goto["do.c:goto_level"]
    goto --> generation["bones or level generation"]
    generation --> arrival["placement, followers, vision, messages"]
```

`#levelchange` is a compact, mostly hero-state subsystem and is now a useful
isolated regression. `#wizlevelport` crosses the full transition/generation
pipeline, so implementing it before ordinary `goto_level()` would hide the same
missing dependency under a debug-specific wrapper.

## 7. State ownership and parity observability

| State | Original owner | Important consumers | How a mismatch becomes visible |
| --- | --- | --- | --- |
| Hero identity, role, race, alignment, stats, movement | `role.c`, `u_init.c`, global `u` | inventory, monsters, commands, status | startup RNG, rank/AC/HP lines, monster attitude |
| Level terrain and topology | `mklev.c`, `sp_lev.c`, `levl`, room arrays | stairs, occupancy, AI, vision, save | later RNG retry counts and persistent screen cells |
| Monsters and scan order | `makemon`, linked list `fmon` | `movemon`, combat, pets, display | movement-ration calls, candidate order, glyph positions |
| Objects and inventory identity | object constructors and linked chains | pets, pickup, menus, save/restore | constructor RNG, equipment strings, object glyphs |
| Tame-animal state | `dog.c`, `dogmove.c`, `edog` | hunger, fetching, movement, combat | ordinary-turn RNG and actor positions |
| Modal/input state | tty window code, `cmd.c`, command queue | time classification, nested prompts | number/order of captures and whether later keys are commands |
| Persistent Lua variables/callbacks | `nhcore.lua` via `nhlua.c` | turn, level enter/leave, save/restore | callback RNG/messages and cross-segment behavior |
| Saved levels/bones | save/load and `bones.c` | `goto_level`, restore, migrations | generation-vs-load branch and complete arrival stream |
| Terminal grid/cursor | vision/display/windowport | scorer capture | exact 80×24 cells and cursor at every input boundary |

## 8. Current JS seam map

This is a planning map, not a claim that the JS side is already equivalent.

| Original C/Lua boundary | Current JS seam | Planning implication |
| --- | --- | --- |
| `newgame`, `role_init`, `u_init` | `js/allmain.js`, `js/roles.js`, `js/u_init.js`, `js/options.js` | Keep selection, role data, inventory, and startup draw order in one contract |
| `mklev` + `themerms.lua` + `sp_lev.c` | `js/mklev.js`, `js/dungeon.js` | Model theme selection, placement failure, topology, and content separately but mutate one live level |
| `parse`/`rhack` and modal tty input | `js/cmd.js`, `js/input.js`, `js/windows.js` | A command must declare whether it consumes time; nested prompts own later keys until dismissal |
| `moveloop_core`, `mcalcmove`, `movemon`, `dochug`, `dog_move` | mostly `js/allmain.js` plus scenario modules | Highest-priority refactor: introduce explicit movement/scheduler/monster/pet ownership before adding more cases |
| vision, glyph mapping, tty capture | `js/vision.js`, `js/display.js`, `js/game_display.js`, `js/terminal.js` | Render from live state; serializer correctness cannot repair wrong world state |
| `goto_level`, save/load, bones | `js/save.js`, `js/storage.js`, `js/mklev.js`, command paths | Separate current-level persistence, destination construction, and arrival pipeline |
| exact public transcript modules | `js/*_fixture.js`, `js/fixture_screen.js` | Keep as regression witnesses; never count them as held-out architecture |

## 9. Planned dependency graph

```mermaid
flowchart TD
    ration["A. Movement ration allocation"] --> scan["B. Stable fmon scan and quiet movemon"]
    scan --> status["C. dochug pre-move status and targeting"]
    status --> pet["D. tame dog_move candidates and goals"]
    pet --> food["E. pet food, inventory, fetching"]
    pet --> combat["F. pet and ordinary monster combat"]
    food --> screens["G. vision, messages, and boundary capture"]
    combat --> screens

    screens --> ordinary["H. ordinary goto_level and bones"]
    ordinary --> vault["I. Water-surrounded vault content"]
    ordinary --> debug["J. debug level teleport"]
    vault --> special["K. special and quest level Lua"]
    debug --> special

    witness1["Witness: seed0004 pony"] --> ration
    witness2["Witness: seed0006 kitten/rat"] --> ration
    witness3["Witness: seed0116 transition"] --> ordinary
    witness4["Witness: seed5006 transition"] --> ordinary
    witness5["Witness: seed0012 vault"] --> vault
    witness6["Witnesses: 0360/0361/0367/0373"] --> debug
```

Each node should advance the earliest exact boundary for at least two witnesses
before the next node begins. A change that only improves a later symptom while
an earlier node still diverges is not evidence for that node.
