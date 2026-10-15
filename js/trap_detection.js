// C detect.c:trap_detect(), detect_obj_traps(), display_trap_map(), sense_trap().
// The caller owns strange_feeling's naming prompt and source consumption.
import { D_TRAPPED, SDOOR, TER_DETECT, TER_MON, TER_OBJ, TER_TRP, TRAPPED_CHEST, TRAPPED_DOOR, isok, } from './const.js';
import { heroToeName } from './body_parts.js';
import { glyphAt, map_object, map_trap, newsym, pline } from './display.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import { browseDetectionMap, clearDetectionMap, redisplayDetectionMap, unconstrainMap, } from './magic_map_display.js';
import { MONSTER_NAME } from './monster_data.js';
import { CHEST, GOLD_PIECE, LARGE_BOX, OBJECT_MERGE, OBJECT_NAMES, getObjectClassBounds, } from './object_data.js';
import { makePlural } from './object_grammar.js';
import { objectClassForType, observeObject } from './object_knowledge.js';
import { getObjectLocation } from './object_location.js';
import { rn2, rnd } from './rng.js';
import { heroIsHallucinating } from './senses.js';
const HERE = 1, ELSEWHERE = 2;
export async function detectTraps(source, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const steed = state.u.usteed;
    if (steed) {
        steed.mx = state.u.ux;
        steed.my = state.u.uy;
    }
    const cursed = !!source?.cursed;
    let found = false;
    for (const trap of floorTraps(state)) {
        if (!atHero(trap.tx, trap.ty, state))
            return await displayTrapMap(cursed, state);
        found = true;
    }
    const objectLists = [floorObjects(state), state.level.buriedObjects || [],
        ...liveMonsters(state).map(monster => monster.minvent || [])];
    for (const objects of objectLists) {
        const location = detectContainerTraps(objects, null, false, state);
        if (location & ELSEWHERE)
            return await displayTrapMap(cursed, state);
        if (location)
            found = true;
    }
    if (detectContainerTraps(state.inventory, null, false, state))
        found = true;
    for (const { x, y } of trappedDoors(state)) {
        if (!atHero(x, y, state))
            return await displayTrapMap(cursed, state);
        found = true;
    }
    const toes = makePlural(heroToeName(state));
    if (found) {
        await pline(`Your ${toes} itch.`);
        return { result: 0, known: false, strangeFeeling: false };
    }
    await pline(state.flags.beginner
        ? `You have a ${heroIsHallucinating(state) ? 'normal' : 'strange'} feeling for a moment, then it passes.`
        : `Your ${toes} stop itching.`);
    return { result: 1, known: false, strangeFeeling: true };
}
async function displayTrapMap(cursed, state) {
    await clearDetectionMap(state);
    const constraints = unconstrainMap(state);
    const objects = new Map();
    try {
        // Floor traps cover chest traps; doors are displayed last, as in C.
        detectContainerTraps(state.level.buriedObjects || [], objects, cursed, state);
        detectContainerTraps(floorObjects(state), objects, cursed, state);
        for (const monster of liveMonsters(state))
            detectContainerTraps(monster.minvent || [], objects, cursed, state);
        detectContainerTraps(state.inventory, objects, cursed, state);
        for (const trap of floorTraps(state))
            senseTrap(trap, objects, cursed, state);
        for (const { x, y } of trappedDoors(state))
            senseTrap({ tx: x, ty: y, ttyp: TRAPPED_DOOR }, objects, cursed, state);
        let mode = TER_DETECT | (cursed ? TER_OBJ : TER_TRP);
        const heroGlyph = glyphAt(state.u.ux, state.u.uy, state);
        if (heroGlyph?.kind !== 'trap' && heroGlyph?.kind !== 'object') {
            newsym(state.u.ux, state.u.uy);
            mode |= TER_MON;
        }
        await pline(`You feel ${cursed ? 'very greedy' : 'entrapped'}.`);
        await browseDetectionMap(mode, cursed ? 'gold' : 'trap of interest', { objects, state });
    }
    finally {
        await redisplayDetectionMap(constraints, state);
    }
    return { result: 0, known: false, strangeFeeling: false };
}
function detectContainerTraps(objects, shown, cursed, state) {
    let result = 0;
    for (const object of objects) {
        const trapped = (object.otyp === CHEST || object.otyp === LARGE_BOX) && object.otrapped;
        const contents = object.contents || [];
        if (!trapped && !contents.length)
            continue;
        const position = getObjectLocation(object, state, { contained: true, buried: true });
        if (!position || !isok(position.x, position.y))
            continue;
        const { x, y } = position;
        if (trapped) {
            object.tknown = true;
            observeObject(object, state);
            result |= atHero(x, y, state) ? HERE : ELSEWHERE;
            if (shown)
                senseTrap({ tx: x, ty: y, ttyp: TRAPPED_CHEST }, shown, cursed, state);
        }
        if (contents.length)
            result |= detectContainerTraps(contents, shown, cursed, state);
    }
    return result;
}
function senseTrap(trap, shown, cursed, state) {
    const hallucinating = heroIsHallucinating(state);
    if (!hallucinating && !cursed) {
        map_trap(trap, true);
        trap.tseen = true;
        return;
    }
    const firstObject = getObjectClassBounds(2).first;
    const otyp = hallucinating
        ? rn2(OBJECT_NAMES.length - firstObject) + firstObject : GOLD_PIECE;
    const quantity = otyp === GOLD_PIECE ? rnd(10) : OBJECT_MERGE[otyp] ? rnd(2) : 1;
    // Native fake objects draw a species even when their type is not a corpse.
    const object = { otyp, oclass: objectClassForType(otyp), ox: trap.tx, oy: trap.ty,
        quan: quantity, quantity, corpsenm: rn2(MONSTER_NAME.length) };
    map_object(object, true);
    shown.set(`${trap.tx},${trap.ty}`, object);
}
function atHero(x, y, state) { return x === state.u.ux && y === state.u.uy; }
function floorTraps(state) { return [...(state.level.traps || [])].reverse(); }
function floorObjects(state) {
    return state.level.objects.flatMap(column => column?.flatMap(pile => pile || []) || [])
        .sort((a, b) => (b._fobjOrder || 0) - (a._fobjOrder || 0));
}
function liveMonsters(state) {
    const monsters = [...(state.level.monsters || [])];
    return monsters.reverse().filter(monster => !monster.dead && monster.mhp > 0 && !(monster.isgd && !monster.mx));
}
function trappedDoors(state) {
    return (state.level.doors || []).slice(0, state.level.doorindex).filter(({ x, y }) => {
        const location = state.level.at(x, y);
        if (!location)
            throw new RangeError(`A trapped door lies outside the map at ${x},${y}`);
        return location.typ !== SDOOR && (location.doormask & D_TRAPPED);
    });
}
//# sourceMappingURL=trap_detection.js.map