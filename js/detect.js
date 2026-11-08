// Detection, searching, magic mapping, crystal balls, and terrain views.
// C detect.c: gold_detect(), food_detect(), object_detect(), monster_detect(),
// trap_detect(), furniture_detect(), level_distance(), use_crystal_ball(),
// do_mapping(), do_vicinity_map(), findit(), openit(), dosearch(), reveal_terrain().
import { RANDOM_CLASS, WEAPON_CLASS, FOOD_CLASS, POTION_CLASS, SCROLL_CLASS, SPBOOK_CLASS, COIN_CLASS, ROCK_CLASS, VENOM_CLASS, } from './objclass.js';
import { objectClassForType, objectMerge, BOULDER, CHEST, LARGE_BOX, LENSES, GOLD_PIECE, OBJECT_BASES, OBJECT_NAMES, CRYSTAL_BALL, getObjectClassBounds, } from './object_data.js';
import { requirePlayingGame, requireGameLevel, game, requireLiveGame } from './gstate.js';
import { monsterAtPosition, monsterHasMapPosition } from './steed.js';
import { heroIsBlind, heroIsDeaf, heroIsHallucinating } from './senses.js';
import { loseHeroHp, nomul, showGetposTip } from './hack.js';
import { artifactById, artifactByName } from './artifact.js';
import { currentAttribute, exerciseWisdom } from './attrib.js';
import { canSpotMonster, canSenseMonster, currentBoulderSymbol, monsterHasWarningProjection, feel_location, flush_screen, glyphAt, magic_map_background, map_background, map_engraving, map_invisible, map_object, map_trap, newsym, see_monsters, show_glyph_cell, under_ground, under_water, unmapObject, unmap_invisible, flashGlyphAt, back_to_glyph, transientMonsterGlyph, transientTrapGlyph, cls, displaySelf, docrt, feel_newsym, OBJECT_CLASS_NAMES, OBJECT_CLASS_SYMBOLS, terrainCoversObjectsAt, cmapSymbolAppearance, } from './display.js';
import { displayMessageWindow, flushPendingTopline } from './topl.js';
import { formatFeltMessage, formatSeenMessage, pline, plineWithContinuation, set_msg_xy } from './pline.js';
import { A_INT, M_AP_FURNITURE, TER_FULL, TREE, BOLT_LIM, COLNO, ROWNO, ROOMOFFSET, STONE, SDOOR, SCORR, DOOR, CORR, D_CLOSED, D_ISOPEN, D_LOCKED, D_NODOOR, D_TRAPPED, IN_SIGHT, M_AP_OBJECT, M_AP_TYPE, STATUE_TRAP, TER_MAP, TRAPPED_CHEST, TRAPPED_DOOR, W_NONDIGGABLE, W_NONPASSWALL, WM_MASK, Is_airlevel, Is_waterlevel, IS_FURNITURE, TER_DETECT, TER_MON, TER_OBJ, TER_TRP, TOE, FOOT, NOSE } from './const.js';
import { isok, ynSingleKey } from './cmd.js';
import { learnObjectType, observeObject, objectMaterial } from './o_init.js';
import { definiteName, objectCombatName, verbForSubject, withIndefiniteArticle, makePlural } from './objnam.js';
import { makeBlinded, makeConfused, makeHallucinated, strangeFeelingMessage } from './potion.js';
import { rnl, rn2, rnd } from './rng.js';
import { commandSafetyPrevention } from './do.js';
import { cansee, clearAreaCells, vision_note_blocker_change } from './vision.js';
import { depth, recordDiscoveredRoom, recordMappedOverviewState } from './dungeon.js';
import { revealMonsterAppearance, wakeMonstersNearWithMessages } from './mon.js';
import { MONSTER_SYMBOL, MONSTER_NAME } from './monster_data.js';
import { displayColorName, monsterName } from './do_name.js';
import { CLR_BRIGHT_GREEN, CLR_GRAY, NO_COLOR } from './terminal.js';
import { visibleRegionAt } from './region.js';
import { openFallingTrap, openHoldingTrap, trapName, triggerBoobyTrap, activateStatueTrapAt } from './trap.js';
import { cmapToGlyph, CmapSymbol, GlyphOffset } from './glyph_numbers.js';
import { MAP_SYMBOLS } from './map_symbols.js';
import { propertyIsActive } from './properties.js';
import { selectMapPosition, showGetposInstructions } from './getpos.js';
import { C_ATR_INVERSE, terminalAttrFromCAttr } from './color_attr.js';
import { findDrawbridgeAt, openDrawbridge } from './dbridge.js';
import { consumeObjectCharge, currency, useUpInventoryStack } from './invent.js';
import { getObjectLocation } from './zap.js';
import { isQuantumBox } from './quantum_cat.js';
import { MONSTER_CLASS_SYMBOLS, monsterDigests, monsterHidesUnder, monsterIsHider, resistsBlnd } from './mondata.js';
import { expelHero } from './mhitu.js';
import { body_part, heroPolyGender } from './polyself.js';
const HERE = 1, ELSEWHERE = 2;
const GOLD = 15;
const GOLD_GOLEM = MONSTER_NAME.indexOf('gold golem');
const LONG_WORM = MONSTER_NAME.indexOf('long worm');
const LONG_WORM_TAIL = MONSTER_NAME.indexOf('long worm tail');
const WORM_TAIL_CLASS = MONSTER_SYMBOL[LONG_WORM_TAIL];
// C detect.c:do_mapping(), do_vicinity_map().
const MAP_MODE = TER_DETECT | TER_MAP | TER_TRP | TER_OBJ;
// C detect.c:unconstrain_map().
export function unconstrainMap(state = game) {
    const saved = { uinwater: state.u.uinwater, uburied: state.u.uburied,
        uswallow: state.u.uswallow, underwater: state.underwater };
    state.iflags.save_uswallow = !!saved.uswallow;
    state.u.uinwater = state.u.uburied = state.u.uswallow = 0;
    state.underwater = false;
    return { saved, changed: !!(saved.uinwater || saved.underwater
            || saved.uburied || saved.uswallow) };
}
// C detect.c:reconstrain_map().
export function reconstrainMap({ saved }, state = game) {
    state.iflags.save_uswallow = false;
    if (saved.uinwater === undefined)
        delete state.u.uinwater;
    else
        state.u.uinwater = saved.uinwater;
    if (saved.uburied === undefined)
        delete state.u.uburied;
    else
        state.u.uburied = saved.uburied;
    if (saved.uswallow === undefined)
        delete state.u.uswallow;
    else
        state.u.uswallow = saved.uswallow;
    if (saved.underwater === undefined)
        delete state.underwater;
    else
        state.underwater = saved.underwater;
}
// C detect.c:map_redisplay().
export async function redisplayDetectionMap(constraints, state = game) {
    reconstrainMap(constraints, state);
    await docrt();
    // C map_redisplay() defers a full restricted redraw: the turn's
    // under_water(0)/under_ground(0) clears the map again instead of
    // repairing only the previous three-by-three viewport.
    if (state.u.uinwater || state.underwater)
        await under_water(2);
    if (state.u.uburied)
        await under_ground(2);
    // C map_redisplay() does not flush: docrt() only sets the status
    // redraw flag ("caller needs to call bot()"), so the restored map and
    // the status line both repaint at moveloop's once-per-input bot() +
    // curs_on_u(), after any monster phase and moves++ have settled.  An
    // eager flush here renders the turn counter one input early whenever
    // the suppressing run flag (travel leaves context.run at 8) blocks the
    // time update that would otherwise re-flag it.
}
// C detect.c:browse_map().
export async function browseDetectionMap(terrainMode, goal, { state = game, } = {}) {
    const hadTip = await showGetposTip(state);
    const savedAutoDescribe = state.iflags.autodescribe;
    const savedTerrainMode = state.iflags.terrainmode;
    state.iflags.autodescribe = true;
    state.iflags.terrainmode = terrainMode;
    try {
        await showGetposInstructions(state);
        if (hadTip)
            await plineWithContinuation(`Move cursor to ${goal}:`);
        // C browse_map() supplies no description callback: getpos.c
        // auto_describe() renders do_screen_description() with the browse's
        // terrainmode active, and that mode already gates which glyph
        // classes its symbol matching and lookat() detail report.
        await selectMapPosition({
            start: { x: state.u.ux, y: state.u.uy },
            prompt: state._pending_message,
            goal, force: false,
        });
    }
    finally {
        if (savedAutoDescribe === undefined)
            delete state.iflags.autodescribe;
        else
            state.iflags.autodescribe = savedAutoDescribe;
        if (savedTerrainMode === undefined)
            delete state.iflags.terrainmode;
        else
            state.iflags.terrainmode = savedTerrainMode;
    }
}
// C detect.c:map_monst().
export async function mapDetectedMonster(monster, showTail, state = game) {
    // Ghosts retain their space symbol. The detected glyph makes that space
    // visible through tty inverse video, independently of pet highlighting.
    const detected = MONSTER_SYMBOL[monster.mnum] === 54;
    const monsterState = detected ? 'detected' : monster.mtame ? 'pet' : 'normal';
    const glyph = transientMonsterGlyph(monster, monsterState);
    const inverse = state.flags.use_inverse !== false
        && state.iflags.use_inverse !== false && state.iflags.wc_inverse !== false;
    const attribute = detected ? inverse ? 1 : 0
        : monster.mtame && state.flags.hilite_pet
            ? terminalAttrFromCAttr(state.iflags.wc2_petattr ?? C_ATR_INVERSE) : 0;
    await show_glyph_cell(monster.mx, monster.my, glyph.ch, glyph.color, false, attribute, glyph);
    if (!showTail || monster.mnum !== LONG_WORM)
        return;
    const tail = transientMonsterGlyph({ mnum: LONG_WORM_TAIL, female: !!monster.female }, monster.mtame ? 'pet' : 'normal');
    for (const segment of [...(monster.wormSegments || [])].reverse()) {
        if (!segment.x)
            continue;
        await show_glyph_cell(segment.x, segment.y, tail.ch, tail.color, false, attribute, tail);
    }
}
// C detect.c:trapped_chest_at()/trapped_door_at() identify the projection,
// not whether a visible box or door still has its trap armed.
export function detectedTrapDisguise(type, x, y) {
    if (glyphAt(x, y)?.kind !== 'trap')
        return null;
    if (type === TRAPPED_CHEST && (!heroIsHallucinating() || rn2(20) === 0)) {
        const level = game.level;
        const boxes = level?.objects[x]?.[y] ?? [];
        const here = x === game.u.ux && y === game.u.uy;
        const carried = here ? [...game.inventory, ...game.u.usteed?.minvent ?? []] : [];
        const monster = level ? monsterAtPosition(level, x, y) : null;
        const isBox = (object) => object.otyp === CHEST || object.otyp === LARGE_BOX;
        if (boxes.some(isBox) || [...carried, ...monster?.minvent ?? []]
            .some(object => isBox(object) && object.otrapped))
            return 'trapped chest';
    }
    if (type === TRAPPED_DOOR && (!heroIsHallucinating() || rn2(20) === 0)
        && game.level?.at(x, y)?.typ === DOOR)
        return 'trapped door';
    return null;
}
// C detect.c:o_in().
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
// C detect.c:o_material().
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
// C detect.c:observe_recursively().
function observeRecursively(object, state) {
    observeObject(object, state);
    for (const child of object.contents || [])
        observeRecursively(child, state);
}
// C detect.c:clear_stale_map()
// Also C detect.c:check_map_spot(): inlined here.
async function clearStaleObjects(objectClass, material, state) {
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
                await unmapObject(x, y);
                changed = true;
            }
        }
    }
    return changed;
}
// C detect.c:gold_detect()
// Also C steal.c:findgold(): inlined as the GOLD_PIECE membership tests
// (monsters' gold and the golem special case) below.
export async function detectGold(source, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const blessed = !!source?.blessed;
    const stale = await clearStaleObjects(COIN_CLASS, blessed ? GOLD : 0, state);
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
        await strangeFeelingMessage(message, state);
        return effectResult(1, false, true);
    }
    if (!remote) {
        if (stale)
            await docrt();
        await plineWithContinuation(`You notice some gold between your ${makePlural(body_part(FOOT, state))}.`);
        return effectResult(0, known);
    }
    await clearDetectionMap(state);
    const constraints = unconstrainMap(state);
    const shown = new Map();
    try {
        for (const object of floors) {
            const found = goldIn(object, blessed, state);
            if (found)
                await showObjectAt(found, object.ox, object.oy, shown);
        }
        for (const monster of monsters) {
            const carried = monsterObjects(monster);
            if (monster.mnum === GOLD_GOLEM || carried.some(object => object.otyp === GOLD_PIECE)) {
                await showObjectAt(detectedCoins(), monster.mx, monster.my, shown);
            }
            else {
                const found = carried.map(object => goldIn(object, blessed, state)).find(Boolean);
                if (found)
                    await showObjectAt(found, monster.mx, monster.my, shown);
            }
        }
        const mode = await showHeroUnlessCovered(shown, state);
        await plineWithContinuation(formatFeltMessage('very greedy, and sense gold!', state));
        exerciseWisdom(true, state);
        await browseDetectionMap(mode, 'gold', { state });
    }
    finally {
        await redisplayDetectionMap(constraints, state);
    }
    return effectResult(0, known);
}
// Part of C detect.c:gold_detect(): the blessed o_material(GOLD) /
// o_in(COIN_CLASS) match.
function goldIn(object, blessed, state) {
    return blessed && objectOfMaterial(object, GOLD, state)
        || objectOfClass(object, COIN_CLASS);
}
// C detect.c:food_detect()
export async function detectFood(source, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const confused = (state.u.confusionTurns ?? 0) > 0 || !!source?.cursed;
    const objectClass = confused ? POTION_CLASS : FOOD_CLASS;
    const what = confused ? 'something' : 'food';
    const stale = await clearStaleObjects(objectClass, 0, state);
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
            await plineWithContinuation(`You sense a lack of ${what} nearby.`);
            await grantEdibility(source, state);
        }
        else if (source) {
            const starts = source.blessed && !state.u.uedibility;
            await strangeFeelingMessage(`Your ${body_part(NOSE, state)} twitches${starts ? ' then starts to tingle' : ''}.`, state, starts);
            if (starts)
                state.u.uedibility = 1;
        }
        return effectResult(stale ? 0 : 1, stale && !confused, !stale && !!source);
    }
    if (!remote) {
        await plineWithContinuation(`You ${source ? 'smell' : 'sense'} ${what} nearby.`);
        await grantEdibility(source, state);
        return effectResult(0, true);
    }
    await clearDetectionMap(state);
    const constraints = unconstrainMap(state);
    const shown = new Map();
    try {
        for (const { object, x, y } of matches)
            await showObjectAt(object, x, y, shown);
        const mode = await showHeroUnlessCovered(shown, state);
        if (!source)
            await plineWithContinuation(`You sense ${what}.`);
        else if (source.blessed) {
            await plineWithContinuation(`Your ${body_part(NOSE, state)} ${state.u.uedibility ? 'continues' : 'starts'} to tingle and you smell ${what}.`);
            state.u.uedibility = 1;
        }
        else
            await plineWithContinuation(`Your ${body_part(NOSE, state)} tingles and you smell ${what}.`);
        exerciseWisdom(true, state);
        await browseDetectionMap(mode, 'food', { state });
    }
    finally {
        await redisplayDetectionMap(constraints, state);
    }
    return effectResult(0, true);
}
// Part of C detect.c:food_detect(): the blessed uedibility grant.
async function grantEdibility(source, state) {
    if (!source?.blessed)
        return;
    if (!state.u.uedibility)
        await plineWithContinuation(`Your ${body_part(NOSE, state)} starts to tingle.`);
    state.u.uedibility = 1;
}
// C detect.c:object_detect()
export async function detectObjects(source, { state = game, objectClass = RANDOM_CLASS } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    if (!Number.isInteger(objectClass) || objectClass < RANDOM_CLASS || objectClass > VENOM_CLASS)
        throw new RangeError(`Invalid object detection class: ${objectClass}`);
    // detect.c:object_detect() cannot tell a class symbol from the
    // user-defined boulder symbol when they match, so it detects both: the
    // buried-object chain stays class-only.
    const boulderClass = objectClass
        && OBJECT_CLASS_SYMBOLS[objectClass] === currentBoulderSymbol(state)
        ? ROCK_CLASS : RANDOM_CLASS;
    const matches = (object) => objectOfClass(object, objectClass) || objectOfClass(object, boulderClass);
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
    for (const object of floors) {
        if (!objectClass && !boulderClass || matches(object)) {
            if (atHero(object.ox, object.oy, state))
                here++;
            else
                elsewhere++;
        }
        if (observe)
            observeRecursively(object, state);
    }
    for (const object of buried) {
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
            if (!objectClass && !boulderClass || matches(object))
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
    const stale = await clearStaleObjects(objectClass, 0, state);
    let what = heroIsHallucinating(state) || ((state.u.confusionTurns ?? 0) > 0 && objectClass === SCROLL_CLASS)
        ? 'something' : objectClass ? OBJECT_CLASS_NAMES[objectClass] : 'objects';
    if (boulderClass && objectClass !== ROCK_CLASS)
        what += ' and/or large stones';
    if (!stale && !elsewhere) {
        if (!here) {
            if (source)
                await strangeFeelingMessage('You feel a lack of something.', state);
            return effectResult(1, false, !!source);
        }
        await plineWithContinuation(`You sense ${what} nearby.`);
        return effectResult(0, false);
    }
    await clearDetectionMap(state);
    const constraints = unconstrainMap(state);
    const shown = new Map();
    try {
        for (const object of buried) {
            const found = objectClass ? objectOfClass(object, objectClass) : object;
            if (found)
                await showObjectAt(found, object.ox, object.oy, shown);
        }
        for (let x = 1; x < COLNO; x++) {
            for (let y = 0; y < ROWNO; y++) {
                const found = (state.level.objects[x]?.[y] || [])
                    .map(object => objectClass || boulderClass ? matches(object) : object).find(Boolean);
                if (found)
                    await showObjectAt(found, x, y, shown);
            }
        }
        for (const monster of monsters) {
            const found = monsterObjects(monster)
                .map(object => objectClass || boulderClass ? matches(object) : object).find(Boolean);
            if (found)
                await showObjectAt(found, monster.mx, monster.my, shown);
            if (misleadingMimic(monster, source, objectClass)) {
                const appearance = monster.mappearance;
                if (appearance === undefined)
                    throw new Error('An object mimic requires an object appearance.');
                // C starts from cg.zeroobj and assigns only otyp, quan, ox,
                // oy, and corpsenm.  oc_class stays zero, so display.h's
                // obj_is_generic() never hides the mimic's appearance behind
                // the potion-class slot: a disguised potion is drawn with its
                // own shuffled oc_color even though no dknown exists.
                const mimicObject = { otyp: appearance, oclass: RANDOM_CLASS,
                    quan: 1, quantity: 1, ox: 0, oy: 0,
                    corpsenm: monster.mcorpsenm !== undefined && monster.mcorpsenm >= 0 ? monster.mcorpsenm : MONSTER_NAME.indexOf('tengu') };
                await showObjectAt(mimicObject, monster.mx, monster.my, shown);
            }
            else if (monsterGold(monster, objectClass)) {
                await showObjectAt(detectedCoins(), monster.mx, monster.my, shown);
            }
        }
        const mode = await showHeroUnlessCovered(shown, state);
        await plineWithContinuation(`You detect the ${elsewhere ? 'presence' : 'absence'} of ${what}.`);
        if (elsewhere)
            await browseDetectionMap(mode, 'object', { state });
        else
            await flushPendingTopline();
    }
    finally {
        await redisplayDetectionMap(constraints, state);
    }
    return effectResult(0, false);
}
// Part of C detect.c:object_detect(): the cursed mimic-appearance match.
function misleadingMimic(monster, source, objectClass) {
    return source?.cursed && M_AP_TYPE(monster) === M_AP_OBJECT
        && (!objectClass || objectClassForType(monster.mappearance ?? -1) === objectClass);
}
// Part of C detect.c:gold_detect(): the findgold()/gold-golem monster test.
function monsterGold(monster, objectClass) {
    return (!objectClass || objectClass === COIN_CLASS)
        && monsterObjects(monster).some(object => object.otyp === GOLD_PIECE);
}
// C detect.c:monster_detect().
export async function detectMonsters(source, { state = game, monsterClass = 0 } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const monsters = liveMonsters(state);
    if (!monsters.length) {
        if (source)
            await strangeFeelingMessage(heroIsHallucinating(state)
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
                await mapDetectedMonster(monster, true, state);
            if (source?.cursed && (monster.msleeping || !monster.mcanmove)) {
                monster.msleeping = monster.mfrozen = 0;
                monster.mcanmove = 1;
                woken = true;
            }
        }
        if (!swallowed)
            await displaySelf();
        await plineWithContinuation('You sense the presence of monsters.');
        if (woken)
            await plineWithContinuation('Monsters sense the presence of you.');
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
// C detect.c:sense_trap().
async function senseTrap(trap, shown, cursed, state) {
    const hallucinating = heroIsHallucinating(state);
    if (!hallucinating && !cursed) {
        await map_trap(trap, true);
        trap.tseen = true;
        return;
    }
    const firstObject = getObjectClassBounds(WEAPON_CLASS).first;
    const otyp = hallucinating
        ? rn2(OBJECT_NAMES.length - firstObject) + firstObject : GOLD_PIECE;
    const quantity = otyp === GOLD_PIECE ? rnd(10) : objectMerge(otyp) ? rnd(2) : 1;
    // Native fake objects draw a species even when their type is not a corpse.
    const object = { otyp, oclass: objectClassForType(otyp), ox: trap.tx, oy: trap.ty,
        quan: quantity, quantity, corpsenm: rn2(MONSTER_NAME.length) };
    await map_object(object, true);
    shown.set(`${trap.tx},${trap.ty}`, object);
}
// Part of C detect.c:sense_trap(): the findone() flash path; the full port
// is senseTrap() above.
// A hallucinating hero remembers a fabricated object glyph, while the real
// trap remains discovered and unchanged.
async function senseDetectedTrap(trap) {
    if (!heroIsHallucinating(game)) {
        await map_trap(trap, true);
        return;
    }
    const firstObject = OBJECT_BASES[WEAPON_CLASS];
    if (firstObject === undefined)
        throw new Error('Object class table has no weapon offset.');
    const type = firstObject + rn2(OBJECT_NAMES.length - firstObject);
    const quantity = type === GOLD_PIECE ? rnd(10) : objectMerge(type) ? rnd(2) : 1;
    const species = rn2(MONSTER_SYMBOL.length);
    const image = { otyp: type, oclass: objectClassForType(type), quantity, quan: quantity,
        corpsenm: species, ox: trap.tx, oy: trap.ty };
    await map_object(image, true, false);
}
// C detect.c:detect_obj_traps(): check one object list for trapped
// containers; ft is the findone() search coordinate, whose count of found
// traps accumulates in ft.numTraps.
async function detectContainerTraps(objects, shown, cursed, state, ft) {
    let result = 0;
    for (const object of objects || []) {
        const trapped = (object.otyp === CHEST || object.otyp === LARGE_BOX) && object.otrapped;
        const contents = object.contents || [];
        if (!trapped && !contents.length)
            continue;
        const position = getObjectLocation(object, state, { contained: true, buried: true });
        if (!position || !isok(position.x, position.y))
            continue;
        const { x, y } = position;
        if (ft && (x !== ft.x || y !== ft.y))
            continue;
        if (trapped) {
            object.tknown = true;
            observeObject(object, state);
            result |= atHero(x, y, state) ? HERE : ELSEWHERE;
            const trap = { tx: x, ty: y, ttyp: TRAPPED_CHEST };
            if (ft) {
                const glyph = transientTrapGlyph(trap);
                await flashGlyphAt(x, y, glyph, 6);
                await senseDetectedTrap(trap);
                await showFoundFeature(x, y, glyph);
                ft.numTraps++;
            }
            else if (shown) {
                await senseTrap(trap, shown, cursed, state);
            }
        }
        if (contents.length)
            result |= await detectContainerTraps(contents, shown, cursed, state, ft);
    }
    return result;
}
// C detect.c:display_trap_map().
async function displayTrapMap(cursed, state) {
    await clearDetectionMap(state);
    const constraints = unconstrainMap(state);
    const objects = new Map();
    try {
        // Floor traps cover chest traps; doors are displayed last, as in C.
        await detectContainerTraps(state.level.buriedObjects || [], objects, cursed, state);
        await detectContainerTraps(floorObjects(state), objects, cursed, state);
        for (const monster of liveMonsters(state))
            await detectContainerTraps(monster.minvent || [], objects, cursed, state);
        await detectContainerTraps(state.inventory, objects, cursed, state);
        for (const trap of floorTraps(state))
            await senseTrap(trap, objects, cursed, state);
        for (const { x, y } of trappedDoors(state))
            await senseTrap({ tx: x, ty: y, ttyp: TRAPPED_DOOR }, objects, cursed, state);
        let mode = TER_DETECT | (cursed ? TER_OBJ : TER_TRP);
        const heroGlyph = glyphAt(state.u.ux, state.u.uy, state);
        if (heroGlyph?.kind !== 'trap' && heroGlyph?.kind !== 'object') {
            await newsym(state.u.ux, state.u.uy);
            mode |= TER_MON;
        }
        await pline(formatFeltMessage(`${cursed ? 'very greedy' : 'entrapped'}.`, state));
        await browseDetectionMap(mode, cursed ? 'gold' : 'trap of interest', { state });
    }
    finally {
        await redisplayDetectionMap(constraints, state);
    }
    return { result: 0, known: false, strangeFeeling: false };
}
// C detect.c:trap_detect()
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
        const location = await detectContainerTraps(objects, null, false, state);
        if (location & ELSEWHERE)
            return await displayTrapMap(cursed, state);
        if (location)
            found = true;
    }
    if (await detectContainerTraps(state.inventory, null, false, state))
        found = true;
    for (const { x, y } of trappedDoors(state)) {
        if (!atHero(x, y, state))
            return await displayTrapMap(cursed, state);
        found = true;
    }
    const toes = makePlural(body_part(TOE, state));
    if (found) {
        await pline(`Your ${toes} itch.`);
        return { result: 0, known: false, strangeFeeling: false };
    }
    await pline(state.flags.beginner
        ? `You have a ${heroIsHallucinating(state) ? 'normal' : 'strange'} feeling for a moment, then it passes.`
        : `Your ${toes} stop itching.`);
    return { result: 1, known: false, strangeFeeling: true };
}
// C detect.c:furniture_detect()
async function detectFurniture() {
    const level = requireGameLevel();
    const constraints = unconstrainMap();
    let found = 0, revealed = 0;
    try {
        for (let y = 0; y < ROWNO; y++) {
            for (let x = 1; x < COLNO; x++) {
                const previous = glyphAt(x, y)?.glyph;
                if (IS_FURNITURE(level.requireAt(x, y).typ)) {
                    found++;
                    await magic_map_background(x, y, true);
                }
                else if (previous !== undefined && previous >= cmapToGlyph(CmapSymbol.upstair)
                    && previous < cmapToGlyph(CmapSymbol.pool)) {
                    found++;
                    const monster = level.monsters.find(monster => !monster.dead && monster.mx === x && monster.my === y);
                    if (monster && M_AP_TYPE(monster) === M_AP_FURNITURE)
                        await revealMonsterAppearance(monster);
                    if (!monster || !canSpotMonster(monster))
                        await map_invisible(x, y);
                }
                if (glyphAt(x, y)?.glyph !== previous)
                    revealed++;
            }
        }
        if (!found)
            await plineWithContinuation('There seems to be nothing of interest on this level.');
        else if (!revealed)
            await plineWithContinuation('Your map already shows all relevant locations.');
        if (!revealed)
            await flushPendingTopline();
        else
            await browseDetectionMap(TER_DETECT | TER_MAP | TER_TRP | TER_OBJ | TER_MON, 'location');
    }
    finally {
        await redisplayDetectionMap(constraints);
    }
}
// C detect.c:level_distance()
function levelDistance(destination) {
    const here = game.u.uz;
    if (!here)
        throw new Error('Crystal-ball vision requires the hero dungeon position');
    const difference = depth(here) - depth(destination);
    const sameDungeon = here.dnum === destination.dnum;
    if (difference < 0) {
        if (difference < -8 - rn2(3))
            return sameDungeon ? 'far below' : 'far away';
        if (difference < -1)
            return sameDungeon ? 'below you' : 'away below you';
        return sameDungeon ? 'just below' : 'in the distance';
    }
    if (difference > 0) {
        if (difference > 8 + rn2(3))
            return sameDungeon ? 'far above' : 'far away';
        if (difference > 1)
            return sameDungeon ? 'above you' : 'away above you';
        return sameDungeon ? 'just above' : 'in the distance';
    }
    return sameDungeon ? 'near you' : 'in the distance';
}
// C detect.c:use_crystal_ball()
// Also C drawing.c:def_char_is_furniture(): inlined here
// Also C drawing.c:def_char_to_monclass(): symbol table lookup is inlined here
export async function useCrystalBall(object) {
    if (heroIsBlind()) {
        await plineWithContinuation(`Too bad you can't see ${definiteName(objectCombatName(object))}.`);
        return object;
    }
    const charged = object.spe > 0;
    const intelligence = currentAttribute(A_INT);
    const questArtifact = !!object.oartifact
        && object.oartifact === artifactByName(game.urole?.artifactName)?.id;
    const difficulty = questArtifact ? 8 : object.blessed ? 16 : 20;
    if (charged && (object.cursed || rnd(difficulty) > intelligence)) {
        const impairment = rnd(100 - 3 * intelligence);
        switch (rnd(object.oartifact || object.blessed ? 4 : 5)) {
            case 1: {
                const name = definiteName(objectCombatName(object));
                await plineWithContinuation(`${name.charAt(0).toUpperCase()}${name.slice(1)} ${verbForSubject(name, 'are')} too much to comprehend!`);
                break;
            }
            case 2: {
                const name = definiteName(objectCombatName(object));
                await plineWithContinuation(`${name.charAt(0).toUpperCase()}${name.slice(1)} ${verbForSubject(name, 'confuse')} you!`);
                await makeConfused((game.u.confusionTurns ?? 0) + impairment, { talk: false });
                break;
            }
            case 3:
                if (resistsBlnd({ youmonst: true })) {
                    const name = definiteName(objectCombatName(object));
                    await plineWithContinuation(`${name.charAt(0).toUpperCase()}${name.slice(1)} ${verbForSubject(name, 'assault')} your vision.`);
                    await plineWithContinuation('You are unaffected!');
                }
                else {
                    const name = definiteName(objectCombatName(object));
                    await plineWithContinuation(`${name.charAt(0).toUpperCase()}${name.slice(1)} ${verbForSubject(name, 'damage')} your vision!`);
                    await makeBlinded((game.u.blindTurns ?? 0) + impairment, { talk: false });
                    if (!heroIsBlind())
                        await plineWithContinuation('Your vision quickly clears.');
                }
                break;
            case 4: {
                const name = definiteName(objectCombatName(object));
                await plineWithContinuation(`${name.charAt(0).toUpperCase()}${name.slice(1)} ${verbForSubject(name, 'zap')} your mind!`);
                await makeHallucinated((game.u.hallucinationTurns ?? 0) + impairment, { talk: false });
                break;
            }
            case 5: {
                const name = definiteName(objectCombatName(object));
                await plineWithContinuation(`${name.charAt(0).toUpperCase()}${name.slice(1)} ${verbForSubject(name, 'explode')}!`);
                await useUpInventoryStack(object);
                const damage = rnd(30);
                await loseHeroHp(game.u.halfPhysicalDamage ? Math.ceil(damage / 2) : damage, 'exploding crystal ball');
                return null;
            }
        }
        await consumeObjectCharge(object);
        return object;
    }
    if (heroIsHallucinating()) {
        nomul(-rnd(charged ? 4 : 2));
        game._helplessReason = 'gazing into a Magic 8-Ball (tm)';
        game._helplessDoneMessage = '';
        if (!charged) {
            await plineWithContinuation(`All you see is funky ${displayColorName(null)} haze.`);
            if (object.spe >= 0)
                return object;
            const name = definiteName(objectCombatName(object));
            await plineWithContinuation(`${name.charAt(0).toUpperCase()}${name.slice(1)} ${verbForSubject(name, 'implode')}!`);
            await useUpInventoryStack(object);
            return null;
        }
        switch (rnd(6)) {
            case 1:
                await plineWithContinuation('You grok some groovy globs of incandescent lava.');
                break;
            case 2:
                await plineWithContinuation(`Whoa!  Psychedelic colors, ${heroPolyGender() === 1 ? 'babe' : 'dude'}!`);
                break;
            case 3:
                await plineWithContinuation(`The crystal pulses with sinister ${displayColorName(null)} light!`);
                break;
            case 4:
                await plineWithContinuation(formatSeenMessage('goldfish swimming above fluorescent rocks.'));
                break;
            case 5:
                await plineWithContinuation(formatSeenMessage('tiny snowflakes spinning around a miniature farmhouse.'));
                break;
            default:
                await plineWithContinuation('Oh wow... like a kaleidoscope!');
                break;
        }
        await consumeObjectCharge(object);
        return object;
    }
    if (game.flags.verbose)
        await plineWithContinuation('You may look for an object, monster, or special map symbol.');
    await flushPendingTopline();
    let symbol = String.fromCharCode(await ynSingleKey('What do you look for? '));
    // C's quitchars matches NUL too; space remains a ghost-class search.
    if ('\0\r\n\x1b'.includes(symbol)) {
        if (game.flags.verbose)
            await plineWithContinuation('Never mind.');
        return object;
    }
    await plineWithContinuation(`You peer into ${definiteName(objectCombatName(object))}...`);
    nomul(-rnd(charged ? 10 : 2));
    game._helplessReason = 'gazing into a crystal ball';
    game._helplessDoneMessage = '';
    if (!charged) {
        await plineWithContinuation('The vision is unclear.');
        if (object.spe >= 0)
            return object;
        const name = definiteName(objectCombatName(object));
        await plineWithContinuation(`${name.charAt(0).toUpperCase()}${name.slice(1)} ${verbForSubject(name, 'implode')}!`);
        await useUpInventoryStack(object);
        return null;
    }
    learnObjectType(CRYSTAL_BALL);
    await consumeObjectCharge(object);
    if (symbol === ']')
        symbol = 'm';
    const furniture = MAP_SYMBOLS.slice(CmapSymbol.upstair, CmapSymbol.fountain + 1)
        .some(feature => feature.ch === symbol);
    const objectClass = OBJECT_CLASS_SYMBOLS.indexOf(symbol);
    const monsterClass = MONSTER_CLASS_SYMBOLS.indexOf(symbol);
    let missing = false;
    if (furniture)
        await detectFurniture();
    else if (objectClass > RANDOM_CLASS)
        missing = (await detectObjects(null, { objectClass })).result !== 0;
    else if (monsterClass > 0)
        missing = (await detectMonsters(null, { monsterClass })).result !== 0;
    // detect.c also matches the search character against
    // showsyms[SYM_BOULDER + SYM_OFF_X], sending it to rock-class detection.
    else if (symbol === currentBoulderSymbol())
        missing = (await detectObjects(null, { objectClass: ROCK_CLASS })).result !== 0;
    else if (symbol === '^')
        missing = (await detectTraps(null)).result !== 0;
    else {
        const destinations = [
            { name: 'Delphi', level: game.oracle_level },
            { name: "Medusa's lair", level: game.medusa_level },
            { name: 'a castle', level: game.stronghold_level },
            { name: "the Wizard of Yendor's tower", level: game.specialLevels?.get('wizard1') },
        ];
        const destination = destinations[rn2(destinations.length)];
        if (!destination)
            throw new Error('Crystal-ball destination is outside its level list');
        if (!destination.level)
            throw new Error(`Crystal-ball destination ${destination.name} is not initialized`);
        await plineWithContinuation(formatSeenMessage(`${destination.name}, ${levelDistance(destination.level)}.`));
    }
    if (missing)
        await plineWithContinuation(rn2(100) === 0
            ? formatSeenMessage('the Wizard of Yendor gazing out at you.') : 'The vision is unclear.');
    return object;
}
// C detect.c:show_map_spot().  The single-square owner also serves probing.
export async function showMapSpot(x, y, { state = game, confused = false, revealAllTraps = false, } = {}) {
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
        await magic_map_background(x, y, false);
        await newsym(x, y);
    }
    else
        await magic_map_background(x, y, true);
    if (!IS_FURNITURE(loc.typ)) {
        const trap = level.traps?.find(candidate => candidate.tx === x && candidate.ty === y);
        const engraving = level.engravings?.find(candidate => candidate.x === x && candidate.y === y);
        if (trap && (trap.tseen || revealAllTraps)) {
            if (revealAllTraps)
                trap.tseen = true;
            await map_trap(trap, true);
        }
        else if (engraving && !confused)
            await map_engraving(engraving, true);
        else if (oldGlyph && ['object', 'trap'].includes(oldGlyph.kind)) {
            if (level.flags.hero_memory)
                loc.remembered_glyph = { ...oldGlyph };
            await show_glyph_cell(x, y, oldGlyph.ch, oldGlyph.color, oldGlyph.decgfx, oldAttribute, oldGlyph);
        }
    }
    if (!confused && loc.roomno >= ROOMOFFSET)
        recordDiscoveredRoom(loc.roomno - ROOMOFFSET, { state });
}
// Part of C detect.c:do_mapping(), detect.c:show_map_spot(): the per-square
// show_map_spot() loop.
// Mapping reveals terrain and secret corridors.  It preserves secret doors,
// unknown traps, and objects the hero had not already seen.
export async function mapLevel({ confused = (game.u?.confusionTurns ?? 0) > 0, revealAllTraps = false, exercise = true, } = {}) {
    for (let x = 1; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++) {
            await showMapSpot(x, y, { confused, revealAllTraps });
        }
    }
    recordMappedOverviewState();
    if (exercise)
        exerciseWisdom();
}
// C detect.c:do_mapping().
export async function mapMagicLevel({ state = game, confused = (state.u.confusionTurns ?? 0) > 0, revealAllTraps = false } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const constraints = unconstrainMap(state);
    try {
        await mapLevel({ confused, revealAllTraps, exercise: false });
        if (!state.level.flags.hero_memory || constraints.changed) {
            await flush_screen(1);
            await browseDetectionMap(MAP_MODE, 'anything of interest', { state });
            await redisplayDetectionMap(constraints, state);
        }
    }
    finally {
        reconstrainMap(constraints, state);
    }
    exerciseWisdom(true, state);
}
// C detect.c:do_vicinity_map().
export async function mapVicinity(source, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const extended = !!source && (source.blessed
        || propertyIsActive('clairvoyant', state) || state.u.clairvoyant);
    const hero = state.u;
    const bounds = { left: Math.max(1, hero.ux - 9),
        right: Math.min(COLNO - 1, hero.ux + 10),
        top: Math.max(0, hero.uy - 5), bottom: Math.min(ROWNO - 1, hero.uy + 6) };
    const visionRow = state.viz_array?.[hero.uy];
    const savedVision = visionRow?.[hero.ux];
    if (!visionRow || savedVision === undefined)
        throw new Error('Mapping requires current hero vision.');
    const savedDetection = hero.clairvoyanceDetection;
    if (hero.uswallow)
        visionRow[hero.ux] = savedVision | IN_SIGHT;
    hero.clairvoyanceDetection = true;
    const constraints = unconstrainMap(state);
    let detectedMonster = false, detectedObject = false, refresh = false;
    try {
        for (let x = bounds.left; x <= bounds.right; x++) {
            for (let y = bounds.top; y <= bounds.bottom; y++) {
                const oldGlyph = glyphAt(x, y, state);
                await showMapSpot(x, y, { state, confused: (hero.confusionTurns ?? 0) > 0 });
                const object = state.level.objects[x]?.[y]?.[0];
                if (object) {
                    if (extended)
                        observeObject(object, state);
                    await map_object(object, true);
                    if (glyphChanged(oldGlyph, glyphAt(x, y, state))
                        && terrainCoversObjectsAt(x, y, state))
                        detectedObject = true;
                }
                const monster = state.level.monsters.find(actor => monsterHasMapPosition(actor, state) &&
                    !actor.dead && actor.mhp > 0 && actor.mx === x && actor.my === y);
                if (!monster)
                    continue;
                if ((constraints.changed || !state.level.flags.hero_memory)
                    && !extended && (x !== hero.ux || y !== hero.uy)
                    && oldGlyph?.kind !== 'monster')
                    await map_invisible(x, y);
                else
                    await mapDetectedMonster(monster, false, state);
                const newGlyph = glyphAt(x, y, state);
                if (extended && glyphChanged(oldGlyph, newGlyph)
                    && newGlyph?.kind !== 'invisible')
                    detectedMonster = true;
            }
        }
        if (!source && state.flags.quick_farsight)
            detectedMonster = detectedObject = false;
        if (!state.level.flags.hero_memory || constraints.changed
            || detectedMonster || detectedObject) {
            await flush_screen(1);
            await pline('You sense your surroundings.');
            const mode = MAP_MODE | (extended || glyphAt(hero.ux, hero.uy)?.kind === 'monster'
                ? TER_MON : 0);
            await browseDetectionMap(mode, 'anything of interest', { state });
            refresh = true;
        }
    }
    finally {
        reconstrainMap(constraints, state);
        if (savedDetection === undefined)
            delete hero.clairvoyanceDetection;
        else
            hero.clairvoyanceDetection = savedDetection;
        visionRow[hero.ux] = savedVision;
    }
    for (let x = bounds.left; x <= bounds.right; x++) {
        for (let y = bounds.top; y <= bounds.bottom; y++) {
            if (x === hero.ux && y === hero.uy)
                continue;
            const glyph = glyphAt(x, y, state);
            if (glyph?.kind !== 'monster' || glyph.mnum === LONG_WORM_TAIL)
                continue;
            const monster = state.level.monsters.find(actor => monsterHasMapPosition(actor, state) &&
                !actor.dead && actor.mhp > 0 && actor.mx === x && actor.my === y);
            if (!monster || !canSpotMonster(monster))
                await map_invisible(x, y);
        }
    }
    await see_monsters();
    if (refresh)
        await docrt();
}
// Part of C detect.c:do_vicinity_map(): the before/after glyph comparison.
// Native compares glyph identities, which include species and object type;
// colors and tty highlighting do not make a different remembered glyph.
function glyphChanged(before, after) {
    if (before?.kind !== after?.kind || glyphCharacter(before) !== glyphCharacter(after))
        return true;
    if (!before || !after)
        return false;
    if (before.kind === 'object' && after.kind === 'object')
        return before.otyp !== after.otyp;
    if (before.kind === 'monster' && after.kind === 'monster')
        return before.mnum !== after.mnum;
    if (before.kind === 'trap' && after.kind === 'trap')
        return before.trapType !== after.trapType;
    return false;
}
// Part of C detect.c:do_vicinity_map(): remembered-symbol half of the glyph
// comparison.
function glyphCharacter(glyph) {
    return glyph && 'ch' in glyph && typeof glyph.ch === 'string' ? glyph.ch : undefined;
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
    location.candig = false;
}
// Part of C detect.c:do_vicinity_map(), detect.c:findit(): revealing a
// secret door via cvt_sdoor_to_door().
export function revealSecretDoor(x, y) {
    const loc = game.level?.at(x, y);
    if (loc?.typ !== SDOOR)
        return false;
    convertSecretDoor(loc);
    vision_note_blocker_change(x, y);
    game.vision_full_recalc = 1;
    return true;
}
// Part of C detect.c:do_vicinity_map(), detect.c:findit(): revealing a
// secret corridor.
export function revealSecretCorridor(x, y) {
    const loc = game.level?.at(x, y);
    if (loc?.typ !== SCORR)
        return false;
    loc.typ = CORR;
    vision_note_blocker_change(x, y);
    game.vision_full_recalc = 1;
    return true;
}
// C detect.c:foundone()
async function showFoundFeature(x, y, glyph) {
    const location = requireGameLevel(game).requireAt(x, y);
    if (glyph.kind === 'terrain' || glyph.kind === 'trap'
        || glyph.kind === 'unexplored')
        location.seenv = 0xff;
    const vision = game.viz_array?.[y];
    const previousVision = vision?.[x];
    if (!vision || previousVision === undefined)
        throw new Error(`No vision cell at ${x},${y}`);
    if (!heroIsBlind(game))
        vision[x] = 3;
    await newsym(x, y);
    vision[x] = previousVision;
}
// Part of C detect.c:find_trap(): the "You find <an> <trap>." message.
function foundTrapMessage(trap) {
    return `You find ${withIndefiniteArticle(trapName(trap.ttyp))}.`;
}
// Part of C detect.c:findit(): the " and " / ", and " list joins.
function joinFindings(parts) {
    if (parts.length < 2)
        return parts[0] || '';
    if (parts.length === 2)
        return `${parts[0]} and ${parts[1]}`;
    return `${parts.slice(0, -1).join(', ')}, and ${parts.at(-1)}`;
}
// Part of C detect.c:findit(): the "a trap"/"%d traps" counts.
function countDescription(count, singular, plural) {
    return count === 1 ? singular : `${count} ${plural}`;
}
// C detect.c:findit().  Magical searching reveals every hidden thing within
// eight spaces that is not behind blocking terrain.
// Also C detect.c:findone(): inlined here.
// Also C detect.c:detecting(): the findone() callback choice is explicit here.
export async function findit() {
    requirePlayingGame(game);
    if (game.u?.uswallow)
        return 0;
    const found = {
        doors: 0, corridors: 0, traps: 0, monsters: 0,
        unseen: 0, keptUnseen: 0, clearedUnseen: 0,
    };
    const cells = await clearAreaCells(game.u.ux, game.u.uy, BOLT_LIM, {
        ignoreBlockers: Is_airlevel(game.u.uz) || Is_waterlevel(game.u.uz),
    });
    for (const { x, y } of cells) {
        const loc = game.level.requireAt(x, y);
        // C's m_at() includes worm tails: each unseen occupied square is
        // detected and remembered independently, even for the same worm.
        const occupant = monsterAtPosition(game.level, x, y);
        const monster = occupant && !occupant.dead && occupant.mhp > 0 ? occupant : null;
        if (loc.typ === SDOOR) {
            await flashGlyphAt(x, y, back_to_glyph({ ...loc, typ: DOOR, doormask: D_CLOSED }, x, y), 6);
            revealSecretDoor(x, y);
            await magic_map_background(x, y, false);
            await showFoundFeature(x, y, back_to_glyph(loc, x, y));
            found.doors++;
        }
        else if (loc.typ === SCORR) {
            const glyph = back_to_glyph({ ...loc, typ: CORR }, x, y);
            await flashGlyphAt(x, y, glyph, 6);
            revealSecretCorridor(x, y);
            await magic_map_background(x, y, false);
            await showFoundFeature(x, y, glyph);
            found.corridors++;
        }
        const trap = game.level.traps?.find(candidate => candidate.tx === x && candidate.ty === y);
        if (trap && !trap.tseen && trap.ttyp !== STATUE_TRAP) {
            const glyph = transientTrapGlyph(trap);
            await flashGlyphAt(x, y, glyph, 6);
            trap.tseen = true;
            await senseDetectedTrap(trap);
            await showFoundFeature(x, y, glyph);
            found.traps++;
        }
        if (loc.typ === DOOR && (loc.doormask & (D_CLOSED | D_LOCKED))
            && (loc.doormask & D_TRAPPED)) {
            const doorTrap = { ttyp: TRAPPED_DOOR, tx: x, ty: y };
            const glyph = transientTrapGlyph(doorTrap);
            await flashGlyphAt(x, y, glyph, 6);
            await senseDetectedTrap(doorTrap);
            await showFoundFeature(x, y, glyph);
            found.traps++;
        }
        // C detect.c:findone() scans every container list at the search
        // coordinate; the trap count comes back through the ft accumulator.
        const cellFind = { x, y, numTraps: 0 };
        await detectContainerTraps(game.level.buriedObjects, null, false, game, cellFind);
        await detectContainerTraps(game.level.objects?.[x]?.[y], null, false, game, cellFind);
        if (monster) {
            await detectContainerTraps(monster.minvent || monster.inventory, null, false, game, cellFind);
        }
        if (game.u.ux === x && game.u.uy === y)
            await detectContainerTraps(game.inventory, null, false, game, cellFind);
        if (cellFind.numTraps) {
            found.traps += cellFind.numTraps;
        }
        if (monster && (!canSpotMonster(monster)
            || monster.mundetected || M_AP_TYPE(monster))) {
            let revealedMonster = false;
            if (M_AP_TYPE(monster)) {
                await flashGlyphAt(x, y, transientMonsterGlyph(monster), 6);
                await revealMonsterAppearance(monster);
                revealedMonster = true;
            }
            else if (monster.mundetected
                && ((monsterHidesUnder(monster.mnum) || monsterIsHider(monster.mnum))
                    || MONSTER_SYMBOL[monster.mnum] === 57)) {
                await flashGlyphAt(x, y, transientMonsterGlyph(monster), 6);
                monster.mundetected = 0;
                await newsym(x, y);
                revealedMonster = true;
            }
            if (revealedMonster)
                found.monsters++;
            if (loc.remembered_glyph?.kind === 'invisible') {
                found.keptUnseen++;
            }
            else if (!canSpotMonster(monster)) {
                await flashGlyphAt(x, y, { ch: 'I', kind: 'invisible' }, 6);
                await map_invisible(x, y);
                found.unseen++;
            }
        }
        else if (await unmap_invisible(x, y)) {
            // C's unmap_invisible() always follows unmap_object() with
            // newsym(), so a visible square rediscovers its floor objects;
            // the flash then ends on that glyph instead of bare background.
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
        await plineWithContinuation(formatFeltMessage(`${found.keptUnseen ? 'somewhat ' : ''}less paranoid.`));
    }
    return total;
}
// C detect.c:openit()/openone(). Each opened feature keeps its normal owner.
// Also C detect.c:detecting(): the openone() callback choice is explicit here.
export async function openit(state = game) {
    requireLiveGame(state);
    requirePlayingGame(state);
    if (state.u.uswallow) {
        const engulfer = state.u.ustuck;
        if (!engulfer)
            throw new Error('Opening a swallowing monster requires its actor.');
        if (monsterDigests(engulfer))
            await plineWithContinuation(heroIsBlind(state) ? 'Its mouth opens!'
                : `${monsterName(engulfer, { capitalized: true, state })} opens its mouth!`);
        await expelHero(engulfer, { state });
        return -1;
    }
    let opened = 0;
    const cells = await clearAreaCells(state.u.ux, state.u.uy, BOLT_LIM, {
        ignoreBlockers: Is_airlevel(state.u.uz) || Is_waterlevel(state.u.uz),
    });
    for (const { x, y } of cells) {
        for (const object of state.level.objects?.[x]?.[y] || []) {
            if ([CHEST, LARGE_BOX].includes(object.otyp) && object.olocked) {
                object.olocked = false;
                opened++;
            }
        }
        const location = state.level.requireAt(x, y);
        if (location.typ === SDOOR || (location.typ === DOOR
            && (location.doormask & (D_CLOSED | D_LOCKED)))) {
            revealSecretDoor(x, y);
            if (location.doormask & D_TRAPPED) {
                const dx = x - state.u.ux, dy = y - state.u.uy;
                if (dx * dx + dy * dy < 3) {
                    if (await triggerBoobyTrap('door', { state }))
                        return opened;
                }
                else
                    await plineWithContinuation(`You ${cansee(x, y) ? 'see'
                        : heroIsDeaf(state) ? 'feel the shock of' : 'hear'} an explosion!`, { noRepeat: true });
                await wakeMonstersNearWithMessages(x, y, 121, state);
                location.doormask = D_NODOOR;
            }
            else
                location.doormask = D_ISOPEN;
            vision_note_blocker_change(x, y);
            await newsym(x, y);
            opened++;
        }
        else if (location.typ === SCORR) {
            revealSecretCorridor(x, y);
            await newsym(x, y);
            opened++;
        }
        else {
            const trap = state.level.traps.find(t => t.tx === x && t.ty === y);
            if (trap) {
                if (!trap.tseen && trap.ttyp !== STATUE_TRAP) {
                    trap.tseen = true;
                    await newsym(x, y);
                    opened++;
                }
                const target = x === state.u.ux && y === state.u.uy ? state.u
                    : state.level.monsters.find(m => monsterHasMapPosition(m, state) && m.mx === x && m.my === y && m.mhp > 0);
                const holding = await openHoldingTrap(target, { state });
                if (holding.changed || (await openFallingTrap(target, {
                    state, trapdoorOnly: true,
                })).changed)
                    opened++;
            }
            else {
                const bridge = findDrawbridgeAt(x, y, state);
                if (bridge) {
                    await openDrawbridge(bridge.x, bridge.y, state);
                    opened++;
                }
            }
        }
        if (state.program_state.gameover)
            break;
    }
    return opened;
}
// C detect.c:find_trap(). Only clutter in the remembered layer needs a
// separate trap display; a visible monster overlays that layer.
export async function findTrap(trap) {
    trap.tseen = true;
    exerciseWisdom();
    await feel_newsym(trap.tx, trap.ty);
    const remembered = game.level?.at(trap.tx, trap.ty)?.remembered_glyph;
    const cleared = heroIsHallucinating(game)
        || remembered?.kind !== 'trap' || remembered.trapType !== trap.ttyp;
    if (cleared) {
        await cls();
        for (let x = 1; x < COLNO; x++) {
            for (let y = 0; y < ROWNO; y++) {
                await show_glyph_cell(x, y, ' ', NO_COLOR, false, 0, { kind: 'nothing' });
            }
        }
        await map_trap(trap, true);
        await displaySelf();
    }
    await plineWithContinuation(foundTrapMessage(trap));
    if (cleared) {
        await flushPendingTopline();
        await docrt();
    }
}
// C detect.c:mfind0(). Searching and Warning share reveal, Wisdom exercise,
// invisible-memory handling, and the description after concealment is gone.
async function findHiddenMonster(monster, viaWarning) {
    let found;
    if (monster.m_ap_type) {
        await revealMonsterAppearance(monster);
        found = true;
    }
    else {
        found = !canSpotMonster(monster);
        const hides = (monsterHidesUnder(monster.mnum) || monsterIsHider(monster.mnum))
            || MONSTER_SYMBOL[monster.mnum] === 57;
        if (monster.mundetected && hides) {
            if (viaWarning && found) {
                // C mfind0() marks the hidden monster's square.
                set_msg_xy(monster.mx, monster.my);
                await plineWithContinuation(`Your danger sense causes you to take a second ${heroIsBlind(game) ? 'to check nearby' : 'look close by'}.`);
                await displayMessageWindow();
            }
            monster.mundetected = 0;
            found = true;
        }
        await newsym(monster.mx, monster.my);
    }
    if (!found)
        return 0;
    if (!canSpotMonster(monster)
        && game.level?.at(monster.mx, monster.my)?.remembered_glyph?.kind === 'invisible')
        return -1;
    exerciseWisdom();
    if (!canSpotMonster(monster)) {
        await map_invisible(monster.mx, monster.my);
        // C mfind0() marks the sensed square before both descriptions.
        set_msg_xy(monster.mx, monster.my);
        await plineWithContinuation(formatFeltMessage('an unseen monster!'));
    }
    else if (!canSenseMonster(monster)) {
        set_msg_xy(monster.mx, monster.my);
        await plineWithContinuation(`You find ${monsterName(monster, {
            article: monster.mtame ? 'your' : 'a',
        })}.`);
    }
    return 1;
}
// C detect.c:dosearch0()
// Coordinate order is x-major, then y; each secret square owns its
// Luck-adjusted roll before later neighbours are examined.  Finding one
// cancels an active count-prefixed occupation via nomul(0), but the
// successful search still consumes the current action.
// Also C artifact.c:spec_ability(): inlined here; the SPFX_SEARCH check
// on the wielded artifact's flags stands in for uwep->spe as search
// bonus.
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
            if (!isok(x, y))
                continue;
            if (x === u.ux && y === u.uy)
                continue;
            const loc = game.level?.at(x, y);
            if (!loc)
                continue;
            if (!automatic && (blind || visibleRegionAt(game, x, y)))
                await feel_location(x, y);
            if (loc.typ === SDOOR) {
                if (rnl(7 - bonus))
                    continue;
                revealSecretDoor(x, y);
                exerciseWisdom();
                nomul(0, game);
                // C dosearch0() maps the discovered door by touch even when
                // its former wall position remains outside line of sight.
                await feel_location(x, y);
                await plineWithContinuation('You find a hidden door.');
                found = true;
                continue;
            }
            if (loc.typ === SCORR) {
                if (rnl(7 - bonus))
                    continue;
                revealSecretCorridor(x, y);
                exerciseWisdom();
                nomul(0, game);
                await feel_newsym(x, y);
                await plineWithContinuation('You find a hidden passage.');
                found = true;
                continue;
            }
            // C detect.c:mfind0().  Explicit search tests a concealed actor
            // before a trap on the same otherwise ordinary square.  Revealing
            // its disguise/concealment is distinct from being able to spot it:
            // a blind hero records an invisible-memory glyph and gets tactile
            // feedback after the Wisdom exercise draw.
            // C m_at() includes worm tails; mfind0() acts on their head.
            const monster = !automatic && game.level
                ? monsterAtPosition(game.level, x, y) : null;
            if (monster) {
                const result = await findHiddenMonster(monster, false);
                if (result === -1)
                    continue;
                if (result > 0)
                    return true;
            }
            else if (!automatic && !blind)
                await unmap_invisible(x, y);
            const trap = game.level?.traps?.find(candidate => candidate.tx === x && candidate.ty === y);
            if (trap && !trap.tseen) {
                if (rnl(8))
                    continue;
                nomul(0, game);
                if (trap.ttyp === STATUE_TRAP) {
                    if (automatic)
                        return { statueTrap: { x, y } };
                    const monster = await activateStatueTrapAt(x, y);
                    if (monster)
                        exerciseWisdom();
                    return true;
                }
                await findTrap(trap);
                found = true;
            }
        }
    }
    return found;
}
// Part of C allmain.c:moveloop_core(): the automatic dosearch0(1) each turn.
// Intrinsic searching uses the same rolls and messages as an explicit
// search, but leaves concealed monsters alone.
export async function automaticSearch() {
    if (game.u.uswallow)
        return false;
    return searchAdjacentSecrets(true);
}
// Part of C do.c:cmd_safety_prevention(): the Searching/another-search
// prompt.
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
// C detect.c:dosearch().
// An ordinary unsuccessful search still consumes time. Counted searches
// repeat this same owner across complete scheduler turns rather than changing
// behavior for a role, coordinate, or command transcript.
export async function dosearch(force = false) {
    if (await preventUnsafeSearch(force))
        return false;
    if (game.u.uswallow) {
        await plineWithContinuation('What are you looking for?  The exit?', { noRepeat: true });
        game.context.move = 1;
        return true;
    }
    const found = await searchAdjacentSecrets();
    game.context.move = 1;
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
// C detect.c:premap_detect()
// Sokoban's Lua `premapped` flag maps the finalized background,
// boulders, and traps before deferred room filling.
// Also C detect.c:skip_premap_detect(): merged here.
export async function premap_detect() {
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
            await map_background(x, y, true);
            const boulder = game.level?.objects?.[x]?.[y]
                ?.find(object => object.otyp === BOULDER);
            if (boulder)
                await map_object(boulder, true, false);
        }
    }
    for (const trap of game.level?.traps || []) {
        trap.tseen = true;
        await map_trap(trap, true);
    }
}
// C detect.c:reveal_terrain_getglyph()
function terrainViewGlyph(location, x, y, subset, swallowed) {
    const level = requireGameLevel();
    const full = !!(subset & TER_FULL), keepObjects = !!(subset & TER_OBJ), keepTraps = !!(subset & TER_TRP);
    const background = () => {
        const glyph = back_to_glyph({ ...location,
            typ: full ? location.typ : location.lastseentyp, seenv: full ? 255 : location.seenv }, x, y);
        return { ...glyph, decgfx: glyph.dec };
    };
    const empty = () => {
        if (level.flags.arboreal) {
            const glyph = back_to_glyph({ ...location, typ: TREE, seenv: 255 }, x, y);
            return { ...glyph, decgfx: glyph.dec };
        }
        return { ch: ' ', color: NO_COLOR, decgfx: false,
            kind: 'terrain', terrainName: 'stone', glyph: cmapToGlyph(CmapSymbol.stone) };
    };
    let glyph;
    if (full) {
        const background = back_to_glyph({ ...location, seenv: 255 }, x, y);
        glyph = { ...background, decgfx: background.dec };
    }
    else {
        const seen = level.flags.hero_memory !== false ? location.seenv : cansee(x, y);
        let remembered = location.remembered_glyph;
        if (level.flags.hero_memory === false) {
            if (seen) {
                const glyph = back_to_glyph(location, x, y);
                remembered = { ...glyph, decgfx: glyph.dec };
            }
            else
                remembered = null;
        }
        const displayed = location.disp_glyph;
        // A non-swallowed square starts from
        // glyph_at(), the screen buffer, whose never-drawn value is
        // GLYPH_UNEXPLORED; levl[][].glyph backs it up only when a monster or
        // warning glyph is being hidden (or the hero is swallowed).
        const unexploredGlyph = () => ({ ch: ' ', color: NO_COLOR,
            decgfx: false, kind: 'unexplored', glyph: GlyphOffset.unexplored });
        // C mklev.c: zerorm.glyph is GLYPH_UNEXPLORED, so a remembered glyph
        // that was never written hides a sensed monster behind unexplored space;
        // the S_stone default only applies without hero memory or after
        // unmap_object().
        const memoryFallback = level.flags.hero_memory !== false ? unexploredGlyph() : empty();
        glyph = !swallowed && displayed ? {
            ...displayed, ch: location.disp_ch, color: location.disp_color, decgfx: location.disp_decgfx,
        } : swallowed ? (remembered ?? memoryFallback) : unexploredGlyph();
        let wasMonster = false;
        if (glyph.kind === 'monster' || glyph.kind === 'warning' || glyph.kind === 'effect') {
            glyph = remembered ?? memoryFallback;
            wasMonster = true;
        }
        const trap = level.traps.find(candidate => candidate.tx === x && candidate.ty === y && candidate.tseen);
        const region = visibleRegionAt(game, x, y);
        const hidesObject = !keepObjects && glyph.kind === 'object';
        if ((hidesObject || glyph.kind === 'invisible')
            && keepTraps && trap && !terrainCoversObjectsAt(x, y))
            glyph = transientTrapGlyph(trap);
        const gas = !!region && glyph.kind === 'terrain'
            && (glyph.glyph === cmapToGlyph(CmapSymbol.cloud) || glyph.glyph === cmapToGlyph(CmapSymbol.poisoncloud));
        const removeObject = !keepObjects && glyph.kind === 'object';
        const removeTrap = !keepTraps && (glyph.kind === 'trap' || gas);
        const exposeRegion = !!region && wasMonster;
        if (removeObject || removeTrap || exposeRegion || glyph.kind === 'invisible') {
            if (!seen)
                glyph = region
                    ? { ch: ' ', color: NO_COLOR, decgfx: false, kind: 'unexplored', glyph: GlyphOffset.unexplored } : empty();
            else if (keepTraps && region && (gas || wasMonster))
                glyph = trap ? transientTrapGlyph(trap)
                    : { kind: 'terrain', terrainName: region.damage ? 'poison cloud' : 'cloud',
                        ch: '#', color: region.damage ? CLR_BRIGHT_GREEN : CLR_GRAY, decgfx: false,
                        glyph: cmapToGlyph(region.damage ? CmapSymbol.poisoncloud : CmapSymbol.cloud) };
            else {
                const mimic = monsterAtPosition(level, x, y);
                if (location.lastseentyp !== location.typ && mimic && M_AP_TYPE(mimic) === M_AP_FURNITURE) {
                    const symbol = mimic.mappearance ?? CmapSymbol.stone;
                    const appearance = cmapSymbolAppearance(symbol);
                    glyph = { ...background(), ch: appearance.ch, decgfx: appearance.dec, glyph: cmapToGlyph(symbol) };
                }
                else
                    glyph = background();
            }
        }
    }
    if (glyph.glyph !== cmapToGlyph(CmapSymbol.darkroom)
        && glyph.glyph !== cmapToGlyph(CmapSymbol.litcorr))
        return glyph;
    const corridor = glyph.glyph === cmapToGlyph(CmapSymbol.litcorr);
    const symbol = corridor ? CmapSymbol.corr : CmapSymbol.room;
    const appearance = cmapSymbolAppearance(symbol);
    return { kind: 'terrain', terrainName: corridor ? 'corridor' : 'floor of a room',
        ch: appearance.ch, color: NO_COLOR, decgfx: appearance.dec, glyph: cmapToGlyph(symbol) };
}
// C detect.c:reveal_terrain()
export async function revealTerrain(subset) {
    const hero = game.u;
    const full = !!(subset & TER_FULL);
    if (!full && (heroIsHallucinating(game) || hero.stunned || hero.stunnedTurns
        || hero.confused || hero.confusionTurns)) {
        await pline('You are too disoriented for this.');
        return;
    }
    // C reveal_terrain(): unconstrain_map() before painting the whole level.
    const constraints = unconstrainMap(game);
    try {
        if (constraints.changed)
            await docrt();
        const level = requireGameLevel();
        for (let x = 1; x < COLNO; x++)
            for (let y = 0; y < ROWNO; y++) {
                const location = level.requireAt(x, y);
                const glyph = terrainViewGlyph(location, x, y, subset, !!constraints.saved.uswallow);
                await show_glyph_cell(x, y, glyph.ch, glyph.color, glyph.decgfx ?? false, 0, glyph);
            }
        await flush_screen(1);
        const kind = full ? 'underlying terrain' : subset & TER_OBJ
            ? 'known terrain, traps, and objects' : subset & TER_TRP
            ? 'known terrain and traps' : 'known terrain';
        await pline(`Showing ${kind} only...`);
        // C browse_map(): force autodescribe on and browse the temporary
        // terrain glyphs with the terrain mode active until a spot is picked.
        await browseDetectionMap(subset | TER_MAP, 'anything of interest', { state: game });
    }
    finally {
        // C map_redisplay(): reconstrain_map(), docrt(), and the deferred
        // under_water(2)/under_ground(2) that makes the turn's restricted
        // update perform the full paged reset instead of a viewport repair.
        await redisplayDetectionMap(constraints, game);
        // C map_redisplay() refills the glyph buffer but does not flush:
        // the restored map and status become visible at moveloop's bot()
        // plus parse()'s flush_screen(1) before the next command key.
        // doterrain() takes no game time, so that input wait follows the
        // browse immediately; paint the restored map here to reach the
        // same on-screen state without waiting for a queued key.
        await flush_screen(1);
    }
}
// Port only: DetectionResult constructor.
function effectResult(result, known, strangeFeeling = false) {
    return { result, known, strangeFeeling };
}
// Part of C detect.c:food_detect(), object_detect(), trap_detect(): place
// the steed under the hero before scanning minvent.
function alignSteed(state) {
    const steed = state.u.usteed;
    if (steed) {
        steed.mx = state.u.ux;
        steed.my = state.u.uy;
    }
}
// Port only: minvent accessor.
function monsterObjects(monster) { return monster.minvent || []; }
// Part of C detect.c:gold_detect(), food_detect(), object_detect(): ox/oy
// placement and map_object() of the found object.
async function showObjectAt(object, x, y, shown) {
    object.ox = x;
    object.oy = y;
    await map_object(object, true);
    shown.set(`${x},${y}`, object);
}
// Part of C detect.c:gold_detect(): the detected-coins object built from
// cg.zeroobj.
// C's detected-coins object is also built from cg.zeroobj; only otyp, quan,
// and the coordinates are assigned, so it keeps a zero oc_class too.
function detectedCoins() {
    const quantity = rnd(10);
    return { otyp: GOLD_PIECE, oclass: RANDOM_CLASS, quan: quantity, quantity, ox: 0, oy: 0 };
}
// Part of C detect.c:display_trap_map(): redisplay the hero unless something
// showed at <ux,uy>.
async function showHeroUnlessCovered(shown, state) {
    let mode = TER_DETECT | TER_OBJ;
    if (!shown.has(`${state.u.ux},${state.u.uy}`)) {
        await newsym(state.u.ux, state.u.uy);
        mode |= TER_MON;
    }
    return mode;
}
// Part of C detect.c:display_trap_map(), detect.c:trap_detect(): the cls()
// clear.
export async function clearDetectionMap(_state = game) {
    await cls();
}
// C you.h:u_at(): state-aware form for callers that run against either the
// live game or a focused unit state.
function atHero(x, y, state) { return x === state.u.ux && y === state.u.uy; }
// Part of C detect.c:display_trap_map(): the ftrap walk.
function floorTraps(state) { return [...(state.level.traps || [])].reverse(); }
// Part of C detect.c:gold_detect(), food_detect(), object_detect(): the
// fobj walk, newest first.
function floorObjects(state) {
    return state.level.objects.flatMap(column => column?.flatMap(pile => pile || []) || [])
        .sort((a, b) => (b._fobjOrder || 0) - (a._fobjOrder || 0));
}
// Part of C detect.c:gold_detect(), monster_detect(), food_detect(): the
// fmon walk with DEADMONSTER()/isgd checks.
function liveMonsters(state) {
    const monsters = [...(state.level.monsters || [])];
    return monsters.reverse().filter(monster => !monster.dead && monster.mhp > 0 && !(monster.isgd && !monster.mx));
}
// Part of C detect.c:display_trap_map(): the doors[] walk for trapped doors.
function trappedDoors(state) {
    return (state.level.doors || []).slice(0, state.level.doorindex).filter(({ x, y }) => {
        const location = state.level.at(x, y);
        if (!location)
            throw new RangeError(`A trapped door lies outside the map at ${x},${y}`);
        return location.typ !== SDOOR && (location.doormask & D_TRAPPED);
    });
}
//# sourceMappingURL=detect.js.map