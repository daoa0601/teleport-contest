import { currency } from './currency.js';
// C detect.c: gold_detect(), food_detect(), object_detect(), monster_detect().
// Physical source consumption and trycall() belong to the caller.
import { COLNO, ROWNO, M_AP_OBJECT, M_AP_TYPE, TER_DETECT, TER_MON, TER_OBJ, } from './const.js';
import { exerciseWisdom } from './attrib.js';
import { heroFootName, heroNoseName } from './body_parts.js';
import { displaySelf, docrt, flushPendingTopline, glyphAt, map_object, newsym, pline, unmapObject, } from './display.js';
import { game, requireLiveGame } from './gstate.js';
import { browseDetectionMap, clearDetectionMap, mapDetectedMonster, redisplayDetectionMap, unconstrainMap, } from './magic_map_display.js';
import { MONSTER_NAME, MONSTER_SYMBOL } from './monster_data.js';
import { monsterName } from './monster_name.js';
import { GOLD_PIECE } from './object_data.js';
import { makePlural } from './object_grammar.js';
import { objectClassForType, observeObject } from './object_knowledge.js';
import { objectMaterial } from './object_material.js';
import { isQuantumBox } from './quantum_cat.js';
import { rnd } from './rng.js';
import { heroIsHallucinating } from './senses.js';
export { mapVicinity, mapMagicLevel } from './magic_mapping.js';
import { requirePlayingGame } from './gstate.js';
const FOOD_CLASS = 7, POTION_CLASS = 8, SPBOOK_CLASS = 10, COIN_CLASS = 12;
const GOLD = 15;
const GOLD_GOLEM = MONSTER_NAME.indexOf('gold golem');
const LONG_WORM = MONSTER_NAME.indexOf('long worm');
const WORM_TAIL_CLASS = MONSTER_SYMBOL[MONSTER_NAME.indexOf('long worm tail')];
export async function detectGold(source, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const blessed = !!source?.blessed;
    const stale = clearStaleObjects(COIN_CLASS, blessed ? GOLD : 0, state);
    const monsters = liveMonsters(state);
    const floors = floorObjects(state);
    let known = stale;
    let steedGold = false;
    let remote = false;
    for (const monster of monsters) {
        if (monster.mnum !== GOLD_GOLEM
            && !monsterObjects(monster).some(object => goldIn(object, blessed, state)))
            continue;
        if (monster === state.u.usteed)
            steedGold = true;
        else {
            known = remote = true;
            break;
        }
    }
    if (!remote) {
        for (const object of floors) {
            if (!goldIn(object, blessed, state))
                continue;
            known = true;
            if (!atHero(object.ox, object.oy, state)) {
                remote = true;
                break;
            }
        }
    }
    if (!known) {
        let message = 'You feel materially poor.';
        if (state.u.umonnum === GOLD_GOLEM)
            message = `You feel like a million ${currency(2, { state })}!`;
        else if (state.inventory.some(object => objectOfClass(object, COIN_CLASS)))
            message = 'You feel worried about your future financial situation.';
        else if (steedGold) {
            const steed = state.u.usteed;
            if (!steed)
                throw new Error('Detected steed gold requires a mounted steed.');
            const name = monsterName(steed, { state,
                article: steed.mtame ? 'your' : 'the', suppressSaddle: true });
            message = `You feel interested in ${name}${name.endsWith('s') ? "'" : "'s"} financial situation.`;
        }
        await strangeFeeling(message, state);
        return effectResult(1, false, true);
    }
    if (!remote) {
        if (stale)
            await docrt();
        await pline(`You notice some gold between your ${makePlural(heroFootName(state))}.`);
        return effectResult(0, known);
    }
    await clearDetectionMap(state);
    const constraints = unconstrainMap(state);
    const shown = new Map();
    try {
        for (const object of floors) {
            const found = goldIn(object, blessed, state);
            if (found)
                showObjectAt(found, object.ox, object.oy, shown);
        }
        for (const monster of monsters) {
            const carried = monsterObjects(monster);
            if (monster.mnum === GOLD_GOLEM || carried.some(object => object.otyp === GOLD_PIECE)) {
                showObjectAt(detectedCoins(), monster.mx, monster.my, shown);
            }
            else {
                const found = carried.map(object => goldIn(object, blessed, state)).find(Boolean);
                if (found)
                    showObjectAt(found, monster.mx, monster.my, shown);
            }
        }
        const mode = showHeroUnlessCovered(shown, state);
        await pline('You feel very greedy, and sense gold!');
        exerciseWisdom(true, state);
        await browseDetectionMap(mode, 'gold', { objects: shown, state });
    }
    finally {
        await redisplayDetectionMap(constraints, state);
    }
    return effectResult(0, known);
}
export async function detectFood(source, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const confused = (state.u.confusionTurns ?? 0) > 0 || !!source?.cursed;
    const objectClass = confused ? POTION_CLASS : FOOD_CLASS;
    const what = confused ? 'something' : 'food';
    const stale = clearStaleObjects(objectClass, 0, state);
    alignSteed(state);
    const matches = [];
    for (const object of floorObjects(state)) {
        const found = objectOfClass(object, objectClass);
        if (found)
            matches.push({ object: found, x: object.ox, y: object.oy });
    }
    for (const monster of liveMonsters(state)) {
        const found = monsterObjects(monster)
            .map(object => objectOfClass(object, objectClass)).find(Boolean);
        if (found)
            matches.push({ object: found, x: monster.mx, y: monster.my });
    }
    const remote = matches.some(({ x, y }) => !atHero(x, y, state));
    if (!matches.length) {
        if (stale) {
            await docrt();
            await pline(`You sense a lack of ${what} nearby.`);
            await grantEdibility(source, state);
        }
        else if (source) {
            const starts = source.blessed && !state.u.uedibility;
            await strangeFeeling(`Your ${heroNoseName(state)} twitches${starts ? ' then starts to tingle' : ''}.`, state, starts);
            if (starts)
                state.u.uedibility = 1;
        }
        return effectResult(stale ? 0 : 1, stale && !confused, !stale && !!source);
    }
    if (!remote) {
        await pline(`You ${source ? 'smell' : 'sense'} ${what} nearby.`);
        await grantEdibility(source, state);
        return effectResult(0, true);
    }
    await clearDetectionMap(state);
    const constraints = unconstrainMap(state);
    const shown = new Map();
    try {
        for (const { object, x, y } of matches)
            showObjectAt(object, x, y, shown);
        const mode = showHeroUnlessCovered(shown, state);
        if (!source)
            await pline(`You sense ${what}.`);
        else if (source.blessed) {
            await pline(`Your ${heroNoseName(state)} ${state.u.uedibility ? 'continues' : 'starts'} to tingle and you smell ${what}.`);
            state.u.uedibility = 1;
        }
        else
            await pline(`Your ${heroNoseName(state)} tingles and you smell ${what}.`);
        exerciseWisdom(true, state);
        await browseDetectionMap(mode, 'food', { objects: shown, state });
    }
    finally {
        await redisplayDetectionMap(constraints, state);
    }
    return effectResult(0, true);
}
export async function detectMonsters(source, { state = game, monsterClass = 0 } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const monsters = liveMonsters(state);
    if (!monsters.length) {
        if (source)
            await strangeFeeling(heroIsHallucinating(state)
                ? 'You get the heebie jeebies.' : 'You feel threatened.', state);
        return effectResult(1, false, !!source);
    }
    const swallowed = state.u.uswallow;
    await clearDetectionMap(state);
    const constraints = unconstrainMap(state);
    const previousDetection = state.u.detectMonsters;
    try {
        let woken = false;
        for (const monster of monsters) {
            if (!monsterClass || MONSTER_SYMBOL[monster.mnum] === monsterClass
                || (monster.mnum === LONG_WORM && monsterClass === WORM_TAIL_CLASS))
                mapDetectedMonster(monster, true, state);
            if (source?.cursed && (monster.msleeping || !monster.mcanmove)) {
                monster.msleeping = monster.mfrozen = 0;
                monster.mcanmove = 1;
                woken = true;
            }
        }
        if (!swallowed)
            displaySelf();
        await pline('You sense the presence of monsters.');
        if (woken)
            await pline('Monsters sense the presence of you.');
        if (source?.blessed && !constraints.changed) {
            await flushPendingTopline();
        }
        else {
            state.u.detectMonsters = true;
            await browseDetectionMap(TER_DETECT | TER_MON, 'monster of interest', { state });
        }
    }
    finally {
        if (previousDetection === undefined)
            delete state.u.detectMonsters;
        else
            state.u.detectMonsters = previousDetection;
        await redisplayDetectionMap(constraints, state);
    }
    return effectResult(0, true);
}
export async function detectObjects(source, { state = game, objectClass = 0 } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    if (!Number.isInteger(objectClass) || objectClass < 0 || objectClass > 17)
        throw new RangeError(`Invalid object detection class: ${objectClass}`);
    const observe = source?.blessed
        && [POTION_CLASS, SPBOOK_CLASS].includes(source.oclass ?? objectClassForType(source.otyp));
    const floors = floorObjects(state);
    const buried = state.level.buriedObjects || [];
    alignSteed(state);
    const monsters = liveMonsters(state);
    let elsewhere = 0, here = 0;
    if (observe)
        for (const object of state.inventory)
            observeRecursively(object, state);
    for (const object of [...floors, ...buried]) {
        if (!objectClass || objectOfClass(object, objectClass)) {
            if (atHero(object.ox, object.oy, state))
                here++;
            else
                elsewhere++;
        }
        if (observe)
            observeRecursively(object, state);
    }
    for (const monster of monsters) {
        for (const object of monsterObjects(monster)) {
            if (!objectClass || objectOfClass(object, objectClass))
                elsewhere++;
            if (observe)
                observeRecursively(object, state);
        }
        if (misleadingMimic(monster, source, objectClass)
            || monsterGold(monster, objectClass)) {
            elsewhere++;
            break;
        }
    }
    const stale = clearStaleObjects(objectClass, 0, state);
    const what = heroIsHallucinating(state) || ((state.u.confusionTurns ?? 0) > 0 && objectClass === 9)
        ? 'something' : objectClass ? objectClassDescription(objectClass) : 'objects';
    if (!stale && !elsewhere) {
        if (!here) {
            if (source)
                await strangeFeeling('You feel a lack of something.', state);
            return effectResult(1, false, !!source);
        }
        await pline(`You sense ${what} nearby.`);
        return effectResult(0, false);
    }
    await clearDetectionMap(state);
    const constraints = unconstrainMap(state);
    const shown = new Map();
    try {
        for (const object of buried) {
            const found = objectClass ? objectOfClass(object, objectClass) : object;
            if (found)
                showObjectAt(found, object.ox, object.oy, shown);
        }
        for (let x = 1; x < COLNO; x++) {
            for (let y = 0; y < ROWNO; y++) {
                const found = (state.level.objects[x]?.[y] || [])
                    .map(object => objectClass ? objectOfClass(object, objectClass) : object).find(Boolean);
                if (found)
                    showObjectAt(found, x, y, shown);
            }
        }
        for (const monster of monsters) {
            const found = monsterObjects(monster)
                .map(object => objectClass ? objectOfClass(object, objectClass) : object).find(Boolean);
            if (found)
                showObjectAt(found, monster.mx, monster.my, shown);
            if (misleadingMimic(monster, source, objectClass)) {
                const appearance = monster.mappearance;
                if (appearance === undefined)
                    throw new Error('An object mimic requires an object appearance.');
                const mimicObject = { otyp: appearance, oclass: objectClassForType(appearance),
                    quan: 1, quantity: 1, ox: 0, oy: 0,
                    corpsenm: monster.mcorpsenm !== undefined && monster.mcorpsenm >= 0 ? monster.mcorpsenm : MONSTER_NAME.indexOf('tengu') };
                showObjectAt(mimicObject, monster.mx, monster.my, shown);
            }
            else if (monsterGold(monster, objectClass)) {
                showObjectAt(detectedCoins(), monster.mx, monster.my, shown);
            }
        }
        const mode = showHeroUnlessCovered(shown, state);
        await pline(`You detect the ${elsewhere ? 'presence' : 'absence'} of ${what}.`);
        if (elsewhere)
            await browseDetectionMap(mode, 'object', { objects: shown, state });
        else
            await flushPendingTopline();
    }
    finally {
        await redisplayDetectionMap(constraints, state);
    }
    return effectResult(0, false);
}
function effectResult(result, known, strangeFeeling = false) {
    return { result, known, strangeFeeling };
}
async function strangeFeeling(message, state, forceMessage = false) {
    await pline(state.flags.beginner && !forceMessage
        ? `You have a ${heroIsHallucinating(state) ? 'normal' : 'strange'} feeling for a moment, then it passes.`
        : message);
}
async function grantEdibility(source, state) {
    if (!source?.blessed)
        return;
    if (!state.u.uedibility)
        await pline(`Your ${heroNoseName(state)} starts to tingle.`);
    state.u.uedibility = 1;
}
function atHero(x, y, state) { return x === state.u.ux && y === state.u.uy; }
function alignSteed(state) {
    const steed = state.u.usteed;
    if (steed) {
        steed.mx = state.u.ux;
        steed.my = state.u.uy;
    }
}
function liveMonsters(state) {
    return [...(state.level.monsters || [])].reverse().filter(monster => !monster.dead && monster.mhp > 0 && !(monster.isgd && !monster.mx));
}
function monsterObjects(monster) { return monster.minvent || []; }
function floorObjects(state) {
    return state.level.objects.flatMap(column => column?.flatMap(pile => pile || []) || [])
        .sort((a, b) => (b._fobjOrder || 0) - (a._fobjOrder || 0));
}
function objectOfClass(object, objectClass) {
    if (!objectClass)
        return null;
    if ((object.oclass ?? objectClassForType(object.otyp)) === objectClass)
        return object;
    if (isQuantumBox(object))
        return null;
    for (const child of object.contents || []) {
        const found = objectOfClass(child, objectClass);
        if (found)
            return found;
    }
    return null;
}
function objectOfMaterial(object, material, state) {
    if (objectMaterial(object, state) === material)
        return object;
    for (const child of object.contents || []) {
        const found = objectOfMaterial(child, material, state);
        if (found)
            return found;
    }
    return null;
}
function goldIn(object, blessed, state) {
    return blessed && objectOfMaterial(object, GOLD, state)
        || objectOfClass(object, COIN_CLASS);
}
function clearStaleObjects(objectClass, material, state) {
    let changed = false;
    const monsters = new Map(liveMonsters(state).map(monster => [`${monster.mx},${monster.my}`, monster]));
    for (let x = 1; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++) {
            const glyph = glyphAt(x, y, state);
            if (glyph?.kind !== 'object')
                continue;
            const monster = monsters.get(`${x},${y}`);
            const objects = [...(state.level.objects[x]?.[y] || []), ...(monster?.minvent || [])];
            const materialMatches = material && objectMaterial(glyph.otyp, state) === material;
            const classMatches = objectClass && objectClassForType(glyph.otyp) === objectClass;
            const stale = !objectClass && !material ? !objects.length
                : materialMatches ? !objects.some(object => objectOfMaterial(object, material, state))
                    : classMatches && !objects.some(object => objectOfClass(object, objectClass));
            if (stale) {
                unmapObject(x, y);
                changed = true;
            }
        }
    }
    return changed;
}
function showObjectAt(object, x, y, shown) {
    object.ox = x;
    object.oy = y;
    map_object(object, true);
    shown.set(`${x},${y}`, object);
}
function detectedCoins() {
    const quantity = rnd(10);
    return { otyp: GOLD_PIECE, oclass: COIN_CLASS, quan: quantity, quantity, ox: 0, oy: 0 };
}
function showHeroUnlessCovered(shown, state) {
    let mode = TER_DETECT | TER_OBJ;
    if (!shown.has(`${state.u.ux},${state.u.uy}`)) {
        newsym(state.u.ux, state.u.uy);
        mode |= TER_MON;
    }
    return mode;
}
function observeRecursively(object, state) {
    observeObject(object, state);
    for (const child of object.contents || [])
        observeRecursively(child, state);
}
function misleadingMimic(monster, source, objectClass) {
    return source?.cursed && M_AP_TYPE(monster) === M_AP_OBJECT
        && (!objectClass || objectClassForType(monster.mappearance ?? -1) === objectClass);
}
function monsterGold(monster, objectClass) {
    return (!objectClass || objectClass === COIN_CLASS)
        && monsterObjects(monster).some(object => object.otyp === GOLD_PIECE);
}
function objectClassDescription(objectClass) {
    return ['', 'strange objects', 'weapons', 'armor', 'rings', 'amulets',
        'tools', 'food', 'potions', 'scrolls', 'spellbooks', 'wands', 'coins',
        'gems', 'large stones', 'iron balls', 'chains', 'venoms'][objectClass];
}
//# sourceMappingURL=magic_detection.js.map