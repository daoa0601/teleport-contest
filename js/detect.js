// detect.js — Searching and detection.
// C ref: detect.c — dosearch(), dosearch0().

import { game } from './gstate.js';
import {
    canSpotMonster, feel_location, map_background, map_invisible,
    map_object, map_trap, newsym, pline,
} from './display.js';
import {
    COLNO, ROWNO, STONE, SDOOR, SCORR, DOOR, CORR,
    D_CLOSED, D_LOCKED, D_TRAPPED,
    TRAP_EXPLANATIONS, W_NONDIGGABLE, W_NONPASSWALL,
} from './const.js';
import { BOULDER } from './object_data.js';
import { rnl, rn2 } from './rng.js';
import {
    commandSafetyPrevention, threateningMonsterNearby,
} from './do.js';
import { vision_note_blocker_change } from './vision.js';

// C ref: detect.c premap_detect().  Sokoban's Lua `premapped` flag maps the
// finalized background, boulders, and traps before deferred room filling.
export function premap_detect() {
    for (let x = 1; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++) {
            const loc = game.level?.at(x, y);
            if (!loc) continue;
            if (loc.typ === STONE
                && (loc.wall_info & (W_NONDIGGABLE | W_NONPASSWALL))) {
                continue;
            }
            loc.seenv = 0xff;
            loc.waslit = true;
            loc.premapped = true;
            if (loc.typ === SDOOR) loc.wall_info = 0;
            map_background(x, y, true);
            const boulder = game.level?.objects?.[x]?.[y]
                ?.find(object => object.otyp === BOULDER);
            if (boulder) map_object(boulder, true, false);
        }
    }
    for (const trap of game.level?.traps || []) map_trap(trap, true);
}

function exerciseWisdom() {
    const wisdom = game.u?.acurr?.a?.[4] ?? 10;
    const amount = rn2(19) > wisdom ? 1 : 0;
    if (!Array.isArray(game.u._exercise)) game.u._exercise = Array(6).fill(0);
    game.u._exercise[4] += amount;
}

function foundTrapMessage(trap) {
    const name = TRAP_EXPLANATIONS[trap?.ttyp] || 'trap';
    const article = /^[aeiou]/i.test(name) ? 'an' : 'a';
    return `You find ${article} ${name}.`;
}

// C detect.c:dosearch0(1), invoked once per global turn by intrinsic
// Searching.  This synchronous branch owns the maintenance RNG and immediate
// map/state changes; it never consumes another hero action.
export function automaticSearch() {
    const u = game.u;
    for (let x = u.ux - 1; x <= u.ux + 1; x++) {
        for (let y = u.uy - 1; y <= u.uy + 1; y++) {
            if (x === u.ux && y === u.uy) continue;
            const loc = game.level?.at(x, y);
            if (!loc) continue;
            if (loc.typ === SDOOR) {
                if (rnl(7)) continue;
                const retained = (loc.doormask || 0)
                    & (D_LOCKED | D_TRAPPED);
                loc.typ = DOOR;
                loc.doormask = retained
                    | ((retained & D_LOCKED) ? 0 : D_CLOSED);
                loc.arboreal_sdoor = 0;
                vision_note_blocker_change(x, y);
                exerciseWisdom();
                game.vision_full_recalc = 1;
                newsym(x, y);
                game._pending_message = 'You find a hidden door.';
                return true;
            }
            if (loc.typ === SCORR) {
                if (rnl(7)) continue;
                loc.typ = CORR;
                vision_note_blocker_change(x, y);
                exerciseWisdom();
                game.vision_full_recalc = 1;
                newsym(x, y);
                game._pending_message = 'You find a hidden passage.';
                return true;
            }
            const trap = game.level?.traps?.find(candidate =>
                candidate.tx === x && candidate.ty === y);
            if (trap && !trap.tseen && !rnl(8)) {
                // detect.c:find_trap() marks the trap and exercises Wisdom
                // before repainting it, for both intrinsic and explicit
                // search callers.
                exerciseWisdom();
                map_trap(trap, true);
                game._pending_message = foundTrapMessage(trap);
                return true;
            }
        }
    }
    return false;
}

// C ref: detect.c:dosearch0().  Coordinate order is x-major, then y; each
// secret square owns its Luck-adjusted roll before later neighbours are
// examined.  Finding one cancels an active count-prefixed occupation via
// nomul(0), but the successful search still consumes the current action.
async function searchAdjacentSecrets() {
    const u = game.u;
    for (let x = u.ux - 1; x <= u.ux + 1; x++) {
        for (let y = u.uy - 1; y <= u.uy + 1; y++) {
            if (x === u.ux && y === u.uy) continue;
            const loc = game.level?.at(x, y);
            if (!loc) continue;
            if (game.blind || (game.u?.blindTurns ?? 0) > 0)
                feel_location(x, y);
            if (loc.typ === SDOOR) {
                if (rnl(7)) continue;
                const retained = (loc.doormask || 0)
                    & (D_LOCKED | D_TRAPPED);
                loc.typ = DOOR;
                loc.doormask = retained
                    | ((retained & D_LOCKED) ? 0 : D_CLOSED);
                loc.arboreal_sdoor = 0;
                vision_note_blocker_change(x, y);
                exerciseWisdom();
                game._occupation = null;
                game.vision_full_recalc = 1;
                newsym(x, y);
                await pline('You find a hidden door.');
                return true;
            }
            if (loc.typ === SCORR) {
                if (rnl(7)) continue;
                loc.typ = CORR;
                vision_note_blocker_change(x, y);
                exerciseWisdom();
                game._occupation = null;
                game.vision_full_recalc = 1;
                newsym(x, y);
                await pline('You find a hidden passage.');
                return true;
            }
            // C detect.c:mfind0().  Explicit search tests a concealed actor
            // before a trap on the same otherwise ordinary square.  Revealing
            // its disguise/concealment is distinct from being able to spot it:
            // a blind hero records an invisible-memory glyph and gets tactile
            // feedback after the Wisdom exercise draw.
            const monster = game.level?.monsters?.find(candidate =>
                !candidate.dead && (candidate.mhp ?? 1) > 0
                && candidate.mx === x && candidate.my === y);
            if (monster) {
                let foundSomething = false;
                if (monster.m_ap_type) {
                    monster.m_ap_type = 0;
                    monster.mappearance = 0;
                    foundSomething = true;
                } else {
                    foundSomething = !canSpotMonster(monster);
                    if (monster.mundetected) {
                        monster.mundetected = 0;
                        foundSomething = true;
                    }
                }
                newsym(x, y);
                if (foundSomething) {
                    const alreadyMarked = game.level?.at(x, y)
                        ?.remembered_glyph?.kind === 'invisible';
                    if (!canSpotMonster(monster) && alreadyMarked) continue;
                    exerciseWisdom();
                    game._occupation = null;
                    if (!canSpotMonster(monster)) {
                        map_invisible(x, y);
                        await pline('You feel an unseen monster!');
                    } else {
                        await pline(`You find a monster.`);
                    }
                    return true;
                }
            }
            const trap = game.level?.traps?.find(candidate =>
                candidate.tx === x && candidate.ty === y);
            if (trap && !trap.tseen) {
                if (rnl(8)) continue;
                trap.tseen = true;
                exerciseWisdom();
                map_trap(trap, true);
                game._occupation = null;
                await pline(foundTrapMessage(trap));
                return true;
            }
        }
    }
    return false;
}

async function preventUnsafeSearch(force = false) {
    return commandSafetyPrevention({
        force,
        multi: !!game._occupation || (game._commandCount ?? 0) > 1,
        verb: 'Searching',
        description: 'another search',
        action: 'You already found a monster.',
        counterKey: '_alreadyFoundFlag',
    });
}

// An ordinary unsuccessful search still consumes time. Counted searches
// repeat this same owner across complete scheduler turns rather than changing
// behavior for a role, coordinate, or command transcript.
export async function dosearch(force = false) {
    if (await preventUnsafeSearch(force)) return false;
    game._commandCount = 0;
    const found = await searchAdjacentSecrets();
    game.context.move = 1;
    return found;
}
