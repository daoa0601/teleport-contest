import { requirePlayingGame, requireGameLevel } from './gstate.js';
// detect.js — Searching and detection.
// C ref: detect.c — dosearch(), dosearch0().
import { monsterHasMapPosition } from './monster_location.js';
import { heroIsHallucinating } from './senses.js';
import { game } from './gstate.js';
import { endVoluntaryMultiTurn } from './command_state.js';
import { artifactById } from './artifacts.js';
import { heroIsBlind } from './senses.js';
import { exerciseWisdom } from './attrib.js';
import { canSpotMonster, canSenseMonster, monsterHasWarningProjection, flushPendingTopline, feel_location, glyphAt, magic_map_background, map_background, map_engraving, map_invisible, map_object, map_trap, newsym, pline, show_glyph_cell, unmap_invisible, plineWithContinuation, flashGlyphAt, terrain_glyph, transientMonsterGlyph, transientTrapGlyph, } from './display.js';
import { BOLT_LIM, COLNO, ROWNO, ROOMOFFSET, STONE, SDOOR, SCORR, DOOR, CORR, M_AP_TYPE, Is_airlevel, Is_waterlevel, IS_FURNITURE, D_CLOSED, D_LOCKED, D_TRAPPED, STATUE_TRAP, TRAPPED_CHEST, TRAPPED_DOOR, TRAP_EXPLANATIONS, W_NONDIGGABLE, W_NONPASSWALL, WM_MASK, } from './const.js';
import { BOULDER, CHEST, LARGE_BOX, LENSES, GOLD_PIECE, OBJECT_BASES, OBJECT_MERGE, OBJECT_NAMES } from './object_data.js';
import { objectClassForType, observeObject } from './object_knowledge.js';
import { activateStatueTrapAt } from './statue_trap.js';
import { rnl, rn2, rnd } from './rng.js';
import { commandSafetyPrevention } from './do.js';
import { clearAreaCells, vision_note_blocker_change } from './vision.js';
import { recordDiscoveredRoom, recordMappedOverviewState } from './dungeon.js';
import { revealMonsterAppearance } from './monster_appearance.js';
import { MONSTER_FLAGS1, MONSTER_SYMBOL } from './monster_data.js';
import { monsterName } from './monster_name.js';
// C ref: detect.c premap_detect().  Sokoban's Lua `premapped` flag maps the
// finalized background, boulders, and traps before deferred room filling.
export function premap_detect() {
    for (let x = 1; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++) {
            const loc = game.level?.at(x, y);
            if (!loc)
                continue;
            if (loc.typ === STONE
                && (loc.wall_info & (W_NONDIGGABLE | W_NONPASSWALL))) {
                continue;
            }
            loc.seenv = 0xff;
            loc.waslit = true;
            loc.premapped = true;
            if (loc.typ === SDOOR)
                loc.wall_info = 0;
            map_background(x, y, true);
            const boulder = game.level?.objects?.[x]?.[y]
                ?.find(object => object.otyp === BOULDER);
            if (boulder)
                map_object(boulder, true, false);
        }
    }
    for (const trap of game.level?.traps || [])
        map_trap(trap, true);
}
// C detect.c:do_mapping() and show_map_spot().  Mapping reveals terrain and
// secret corridors.  It preserves secret doors, unknown traps, and objects
// the hero had not already seen.
export function mapLevel({ confused = (game.u?.confusionTurns ?? 0) > 0, revealAllTraps = false, exercise = true, } = {}) {
    for (let x = 1; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++) {
            showMapSpot(x, y, { confused, revealAllTraps });
        }
    }
    recordMappedOverviewState({ mapped: !confused });
    if (exercise)
        exerciseWisdom();
}
// C detect.c:show_map_spot().  The single-square owner also serves probing.
export function showMapSpot(x, y, { state = game, confused = false, revealAllTraps = false, } = {}) {
    if (confused && rn2(7))
        return;
    const level = state.level;
    const loc = level?.at(x, y);
    if (!level || !loc)
        return;
    loc.seenv = 0xff;
    if (loc.typ === SCORR) {
        loc.typ = CORR;
        vision_note_blocker_change(x, y);
    }
    const shown = glyphAt(x, y, state);
    const oldGlyph = shown ? { ...shown, ch: 'ch' in shown && typeof shown.ch === 'string' ? shown.ch : loc.disp_ch,
        color: 'color' in shown && typeof shown.color === 'number' ? shown.color : loc.disp_color, decgfx: 'decgfx' in shown && typeof shown.decgfx === 'boolean' ? shown.decgfx : loc.disp_decgfx } : null;
    const oldAttribute = loc.disp_attr;
    if (level.flags.hero_memory) {
        magic_map_background(x, y, false);
        newsym(x, y);
    }
    else
        magic_map_background(x, y, true);
    if (!IS_FURNITURE(loc.typ)) {
        const trap = level.traps?.find(candidate => candidate.tx === x && candidate.ty === y);
        const engraving = level.engravings?.find(candidate => candidate.x === x && candidate.y === y);
        if (trap && (trap.tseen || revealAllTraps))
            map_trap(trap, true);
        else if (engraving && !confused)
            map_engraving(engraving, true);
        else if (oldGlyph && ['object', 'trap'].includes(oldGlyph.kind)) {
            if (level.flags.hero_memory)
                loc.remembered_glyph = { ...oldGlyph };
            show_glyph_cell(x, y, oldGlyph.ch, oldGlyph.color, oldGlyph.decgfx, oldAttribute, oldGlyph);
        }
    }
    if (!confused && loc.roomno >= ROOMOFFSET)
        recordDiscoveredRoom(loc.roomno - ROOMOFFSET, { state });
}
function foundTrapMessage(trap) {
    const name = TRAP_EXPLANATIONS[trap?.ttyp] || 'trap';
    const article = /^[aeiou]/i.test(name) ? 'an' : 'a';
    return `You find ${article} ${name}.`;
}
// C detect.c:cvt_sdoor_to_door(). Callers own visibility and discovery.
export function convertSecretDoor(location, state = game) {
    const retained = location.doormask & ~WM_MASK;
    const rogueLevel = state.rogue_level;
    const here = state.u.uz;
    const isRogueLevel = !!rogueLevel && !!here && rogueLevel.dnum === here.dnum
        && rogueLevel.dlevel === here.dlevel;
    location.typ = DOOR;
    location.doormask = isRogueLevel
        ? 0 : retained | ((retained & D_LOCKED) ? 0 : D_CLOSED);
    location.arboreal_sdoor = 0;
}
export function revealSecretDoor(x, y) {
    const loc = game.level?.at(x, y);
    if (loc?.typ !== SDOOR)
        return false;
    convertSecretDoor(loc);
    vision_note_blocker_change(x, y);
    game.vision_full_recalc = 1;
    return true;
}
export function revealSecretCorridor(x, y) {
    const loc = game.level?.at(x, y);
    if (loc?.typ !== SCORR)
        return false;
    loc.typ = CORR;
    vision_note_blocker_change(x, y);
    game.vision_full_recalc = 1;
    return true;
}
// Intrinsic searching uses the same rolls and messages as an explicit
// search, but leaves concealed monsters alone.
export async function automaticSearch() {
    if (game.u.uswallow)
        return false;
    return searchAdjacentSecrets(true);
}
// C ref: detect.c:dosearch0().  Coordinate order is x-major, then y; each
// secret square owns its Luck-adjusted roll before later neighbours are
// examined.  Finding one cancels an active count-prefixed occupation via
// nomul(0), but the successful search still consumes the current action.
async function searchAdjacentSecrets(automatic = false) {
    const u = game.u;
    const weapon = game.uwep;
    let bonus = artifactById(weapon?.oartifact)?.flags.includes('SPFX_SEARCH')
        ? weapon?.spe ?? 0 : 0;
    const blind = heroIsBlind(game);
    if (game.ublindf?.otyp === LENSES && !blind)
        bonus += 2;
    bonus = Math.min(bonus, 5);
    let found = false;
    for (let x = u.ux - 1; x <= u.ux + 1; x++) {
        for (let y = u.uy - 1; y <= u.uy + 1; y++) {
            if (x === u.ux && y === u.uy)
                continue;
            const loc = game.level?.at(x, y);
            if (!loc)
                continue;
            if (!automatic && blind)
                feel_location(x, y);
            if (loc.typ === SDOOR) {
                if (rnl(7 - bonus))
                    continue;
                revealSecretDoor(x, y);
                exerciseWisdom();
                endVoluntaryMultiTurn(game);
                newsym(x, y);
                await plineWithContinuation('You find a hidden door.');
                found = true;
                continue;
            }
            if (loc.typ === SCORR) {
                if (rnl(7 - bonus))
                    continue;
                revealSecretCorridor(x, y);
                exerciseWisdom();
                endVoluntaryMultiTurn(game);
                newsym(x, y);
                await plineWithContinuation('You find a hidden passage.');
                found = true;
                continue;
            }
            // C detect.c:mfind0().  Explicit search tests a concealed actor
            // before a trap on the same otherwise ordinary square.  Revealing
            // its disguise/concealment is distinct from being able to spot it:
            // a blind hero records an invisible-memory glyph and gets tactile
            // feedback after the Wisdom exercise draw.
            const monster = automatic ? undefined : game.level?.monsters?.find(candidate => monsterHasMapPosition(candidate, game) &&
                !candidate.dead && (candidate.mhp ?? 1) > 0
                && candidate.mx === x && candidate.my === y);
            if (monster) {
                const result = await findHiddenMonster(monster, false);
                if (result === -1)
                    continue;
                if (result > 0)
                    return true;
            }
            else if (!automatic && !blind)
                unmap_invisible(x, y);
            const trap = game.level?.traps?.find(candidate => candidate.tx === x && candidate.ty === y);
            if (trap && !trap.tseen) {
                if (rnl(8))
                    continue;
                endVoluntaryMultiTurn(game);
                if (trap.ttyp === STATUE_TRAP) {
                    if (automatic)
                        return { statueTrap: { x, y } };
                    const monster = await activateStatueTrapAt(x, y);
                    if (monster)
                        exerciseWisdom();
                    return true;
                }
                trap.tseen = true;
                exerciseWisdom();
                map_trap(trap, true);
                await plineWithContinuation(foundTrapMessage(trap));
                found = true;
            }
        }
    }
    return found;
}
// C detect.c:warnreveal(). Ordinary Warning can expose a nearby hider
// without identifying distant monsters or peaceful neighbours.
export async function revealWarnedMonsters() {
    for (let x = game.u.ux - 1; x <= game.u.ux + 1; x++) {
        for (let y = game.u.uy - 1; y <= game.u.uy + 1; y++) {
            if (x === game.u.ux && y === game.u.uy)
                continue;
            const monster = game.level?.monsters.find(candidate => monsterHasMapPosition(candidate, game) && !candidate.dead
                && candidate.mhp > 0 && candidate.mx === x && candidate.my === y);
            if (monster?.mundetected && monsterHasWarningProjection(monster)
                && (monster.m_lev ?? 0) >= 4)
                await findHiddenMonster(monster, true);
        }
    }
}
// C detect.c:mfind0(). Searching and Warning share reveal, Wisdom exercise,
// invisible-memory handling, and the description after concealment is gone.
async function findHiddenMonster(monster, viaWarning) {
    let found;
    if (monster.m_ap_type) {
        revealMonsterAppearance(monster);
        found = true;
    }
    else {
        found = !canSpotMonster(monster);
        const hides = ((MONSTER_FLAGS1[monster.mnum] ?? 0) & (M1_CONCEAL | M1_HIDE))
            || MONSTER_SYMBOL[monster.mnum] === 57;
        if (monster.mundetected && hides) {
            if (viaWarning && found) {
                await plineWithContinuation(`Your danger sense causes you to take a second ${heroIsBlind(game) ? 'to check nearby' : 'look close by'}.`);
                await flushPendingTopline();
            }
            monster.mundetected = 0;
            found = true;
        }
        newsym(monster.mx, monster.my);
    }
    if (!found)
        return 0;
    if (!canSpotMonster(monster)
        && game.level?.at(monster.mx, monster.my)?.remembered_glyph?.kind === 'invisible')
        return -1;
    exerciseWisdom();
    if (!canSpotMonster(monster)) {
        map_invisible(monster.mx, monster.my);
        await plineWithContinuation('You feel an unseen monster!');
    }
    else if (!canSenseMonster(monster)) {
        await plineWithContinuation(`You find ${monsterName(monster, {
            article: monster.mtame ? 'your' : 'a',
        })}.`);
    }
    return 1;
}
// C detect.c:sense_trap(). A hallucinating hero remembers a fabricated
// object glyph, while the real trap remains discovered and unchanged.
function senseDetectedTrap(trap) {
    if (!heroIsHallucinating(game)) {
        map_trap(trap, true);
        return;
    }
    const firstObject = OBJECT_BASES[2];
    if (firstObject === undefined)
        throw new Error('Object class table has no weapon offset.');
    const type = firstObject + rn2(OBJECT_NAMES.length - firstObject);
    const quantity = type === GOLD_PIECE ? rnd(10) : OBJECT_MERGE[type] ? rnd(2) : 1;
    const species = rn2(MONSTER_SYMBOL.length);
    const image = { otyp: type, oclass: objectClassForType(type), quantity, quan: quantity,
        corpsenm: species, ox: trap.tx, oy: trap.ty };
    map_object(image, true, false);
}
function showFoundFeature(x, y, glyph) {
    const location = requireGameLevel(game).requireAt(x, y);
    if (!glyph.kind || glyph.kind === 'terrain')
        location.seenv = 0xff;
    const vision = game.viz_array?.[y];
    const previousVision = vision?.[x];
    if (!vision || previousVision === undefined)
        throw new Error(`No vision cell at ${x},${y}`);
    if (!heroIsBlind(game))
        vision[x] = 3;
    newsym(x, y);
    vision[x] = previousVision;
}
async function revealTrappedContainers(objects, x, y) {
    let found = 0;
    for (const object of objects || []) {
        if ([LARGE_BOX, CHEST].includes(object.otyp) && object.otrapped) {
            object.tknown = true;
            observeObject(object, game);
            const trap = { ttyp: TRAPPED_CHEST, tx: x, ty: y };
            const glyph = transientTrapGlyph(trap);
            await flashGlyphAt(x, y, glyph, 6);
            senseDetectedTrap(trap);
            showFoundFeature(x, y, glyph);
            found++;
        }
        found += await revealTrappedContainers(object.contents, x, y);
    }
    return found;
}
function joinFindings(parts) {
    if (parts.length < 2)
        return parts[0] || '';
    if (parts.length === 2)
        return `${parts[0]} and ${parts[1]}`;
    return `${parts.slice(0, -1).join(', ')}, and ${parts.at(-1)}`;
}
function countDescription(count, singular, plural) {
    return count === 1 ? singular : `${count} ${plural}`;
}
const M1_CONCEAL = 0x80, M1_HIDE = 0x100;
// C detect.c:findit().  Magical searching reveals every hidden thing within
// eight spaces that is not behind blocking terrain.
export async function findit() {
    requirePlayingGame(game);
    if (game.u?.uswallow)
        return 0;
    const found = {
        doors: 0, corridors: 0, traps: 0, monsters: 0,
        unseen: 0, keptUnseen: 0, clearedUnseen: 0,
    };
    const cells = clearAreaCells(game.u.ux, game.u.uy, BOLT_LIM, {
        ignoreBlockers: Is_airlevel(game.u.uz) || Is_waterlevel(game.u.uz),
    });
    for (const { x, y } of cells) {
        const loc = game.level.requireAt(x, y);
        const monster = game.level.monsters?.find(candidate => monsterHasMapPosition(candidate, game) &&
            !candidate.dead && (candidate.mhp ?? 1) > 0
            && candidate.mx === x && candidate.my === y);
        if (loc.typ === SDOOR) {
            await flashGlyphAt(x, y, terrain_glyph({ ...loc, typ: DOOR, doormask: D_CLOSED }, x, y), 6);
            revealSecretDoor(x, y);
            magic_map_background(x, y, false);
            showFoundFeature(x, y, terrain_glyph(loc, x, y));
            found.doors++;
        }
        else if (loc.typ === SCORR) {
            const glyph = terrain_glyph({ ...loc, typ: CORR }, x, y);
            await flashGlyphAt(x, y, glyph, 6);
            revealSecretCorridor(x, y);
            magic_map_background(x, y, false);
            showFoundFeature(x, y, glyph);
            found.corridors++;
        }
        const trap = game.level.traps?.find(candidate => candidate.tx === x && candidate.ty === y);
        if (trap && !trap.tseen && trap.ttyp !== STATUE_TRAP) {
            const glyph = transientTrapGlyph(trap);
            await flashGlyphAt(x, y, glyph, 6);
            trap.tseen = true;
            senseDetectedTrap(trap);
            showFoundFeature(x, y, glyph);
            found.traps++;
        }
        if (loc.typ === DOOR && (loc.doormask & (D_CLOSED | D_LOCKED))
            && (loc.doormask & D_TRAPPED)) {
            const doorTrap = { ttyp: TRAPPED_DOOR, tx: x, ty: y };
            const glyph = transientTrapGlyph(doorTrap);
            await flashGlyphAt(x, y, glyph, 6);
            senseDetectedTrap(doorTrap);
            showFoundFeature(x, y, glyph);
            found.traps++;
        }
        let trappedContainers = await revealTrappedContainers(game.level.buriedObjects?.filter(object => object.ox === x && object.oy === y), x, y);
        trappedContainers += await revealTrappedContainers(game.level.objects?.[x]?.[y], x, y);
        if (monster) {
            trappedContainers += await revealTrappedContainers(monster.minvent || monster.inventory, x, y);
        }
        if (game.u.ux === x && game.u.uy === y)
            trappedContainers += await revealTrappedContainers(game.inventory, x, y);
        if (trappedContainers) {
            found.traps += trappedContainers;
        }
        if (monster && (!canSpotMonster(monster)
            || monster.mundetected || M_AP_TYPE(monster))) {
            let revealedMonster = false;
            if (M_AP_TYPE(monster)) {
                await flashGlyphAt(x, y, transientMonsterGlyph(monster), 6);
                revealMonsterAppearance(monster);
                revealedMonster = true;
            }
            else if (monster.mundetected
                && (((MONSTER_FLAGS1[monster.mnum] ?? 0) & (M1_CONCEAL | M1_HIDE))
                    || MONSTER_SYMBOL[monster.mnum] === 57)) {
                await flashGlyphAt(x, y, transientMonsterGlyph(monster), 6);
                monster.mundetected = 0;
                revealedMonster = true;
            }
            if (revealedMonster)
                found.monsters++;
            newsym(x, y);
            if (loc.remembered_glyph?.kind === 'invisible') {
                found.keptUnseen++;
            }
            else if (!canSpotMonster(monster)) {
                await flashGlyphAt(x, y, { ch: 'I', kind: 'invisible' }, 6);
                map_invisible(x, y);
                found.unseen++;
            }
        }
        else if (unmap_invisible(x, y, false)) {
            await flashGlyphAt(x, y, { ch: 'I', kind: 'invisible' }, 6);
            found.clearedUnseen++;
        }
    }
    const revealed = [];
    if (found.doors) {
        revealed.push(countDescription(found.doors, 'a secret door', 'secret doors'));
    }
    if (found.corridors) {
        revealed.push(countDescription(found.corridors, 'a secret corridor', 'secret corridors'));
    }
    if (found.traps)
        revealed.push(countDescription(found.traps, 'a trap', 'traps'));
    if (found.monsters) {
        revealed.push(countDescription(found.monsters, 'a hidden monster', 'hidden monsters'));
    }
    if (revealed.length)
        await plineWithContinuation(`You reveal ${joinFindings(revealed)}!`);
    if (found.unseen) {
        const qualifier = found.keptUnseen ? ' other' : '';
        const amount = found.unseen === 1
            ? `${found.keptUnseen ? 'another' : 'an'} unseen monster`
            : `${found.unseen}${qualifier} unseen monsters`;
        await plineWithContinuation(`You detect ${amount}!`);
    }
    const total = found.doors + found.corridors + found.traps
        + found.monsters + found.unseen + found.clearedUnseen;
    if (!total)
        await plineWithContinuation("You don't find anything.");
    else if (found.clearedUnseen && total === found.clearedUnseen) {
        await plineWithContinuation(`You feel ${found.keptUnseen ? 'somewhat ' : ''}less paranoid.`);
    }
    return total;
}
async function preventUnsafeSearch(force = false) {
    return commandSafetyPrevention({
        force,
        multi: !!game.multi,
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
    if (await preventUnsafeSearch(force))
        return false;
    const found = await searchAdjacentSecrets();
    game.context.move = 1;
    return found;
}
//# sourceMappingURL=detect.js.map