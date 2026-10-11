// Temporary disguises caused by eating mimic corpses. C dogmove.c:quickmimic().
import { DISMOUNT_POLY, M_AP_FURNITURE, M_AP_MONSTER, M_AP_OBJECT } from './const.js';
import { canSpotMonster, displayMessageWindow, glyphAt, newsym, plineWithContinuation, } from './display.js';
import { game, requireLiveGame } from './gstate.js';
import { MAP_SYMBOLS } from './map_symbols.js';
import { MONSTER_NAME, MONSTER_SYMBOL, monsterTypeName } from './monster_data.js';
import { releaseMonsterLeash } from './monster_leash.js';
import { monsterName } from './monster_name.js';
import { OBJECT_DESCRIPTIONS, OBJECT_NAMES, TRIPE_RATION, requireObjectData } from './object_data.js';
import { withIndefiniteArticle } from './object_grammar.js';
import { rn2 } from './rng.js';
import { dismountHero } from './steed.js';
import { cansee } from './vision.js';
const DOG_SYMBOL = 4;
const SINK_APPEARANCE = MAP_SYMBOLS.findIndex(symbol => symbol.name === 'sink');
const FOOD_DISGUISE = { type: M_AP_OBJECT, appearance: TRIPE_RATION };
const DISGUISES = [
    monsterDisguise('little dog', 'kitten'),
    monsterDisguise('dog', 'housecat'),
    monsterDisguise('large dog', 'large cat'),
    monsterDisguise('kitten', 'little dog'),
    monsterDisguise('housecat', 'dog'),
    monsterDisguise('large cat', 'large dog'),
    monsterDisguise('housecat', 'giant rat'),
    { symbol: DOG_SYMBOL, type: M_AP_FURNITURE, appearance: SINK_APPEARANCE },
    FOOD_DISGUISE,
];
export async function beginMonsterMealMimicry(monster, state = game) {
    requireLiveGame(state);
    const wasLeashed = !!monster.mleashed;
    if (state.u.protectionFromShapeChangers || state.protectionFromShapeChangers
        || !monster.meating)
        return;
    if (monster === state.u.usteed)
        await dismountHero(DISMOUNT_POLY, { state });
    const disguise = chooseMealDisguise(monster);
    const name = monsterName(monster, { state, article: 'your' });
    const spotted = canSpotMonster(monster);
    const seeLocation = cansee(monster.mx, monster.my);
    monster.m_ap_type = disguise.type;
    monster.mappearance = disguise.appearance;
    if (!spotted && !seeLocation && !canSpotMonster(monster))
        return;
    const previousGlyph = glyphAt(monster.mx, monster.my, state);
    const description = disguiseDescription(disguise, monster.female);
    newsym(monster.mx, monster.my);
    // All animal disguises in qm[] are leashable. Furniture and food are not.
    if (wasLeashed && disguise.type !== M_AP_MONSTER) {
        await plineWithContinuation('Your leash goes slack.');
        releaseMonsterLeash(monster, state);
    }
    if (samePerceivedGlyph(previousGlyph, glyphAt(monster.mx, monster.my, state))) {
        await plineWithContinuation(`You sense that ${name} feels rather ${description}-ish.`);
    }
    else {
        await plineWithContinuation(`You ${seeLocation ? 'see' : 'sense that'} ${withIndefiniteArticle(description)} ${seeLocation ? 'appear' : 'has appeared'} where ${name} was!`);
    }
    await displayMessageWindow();
}
function monsterDisguise(species, appearance) {
    return { species: MONSTER_NAME.indexOf(species),
        type: M_AP_MONSTER, appearance: MONSTER_NAME.indexOf(appearance) };
}
function chooseMealDisguise(monster) {
    for (let tries = 0; tries < 5; tries++) {
        const choice = DISGUISES[rn2(DISGUISES.length)];
        if (!choice)
            throw new RangeError('Mimic meal selected an invalid disguise.');
        if (choice.species !== undefined && choice.species === monster.mnum
            || choice.symbol !== undefined && choice.symbol === MONSTER_SYMBOL[monster.mnum]
            || choice.species === undefined && choice.symbol === undefined)
            return choice;
    }
    return FOOD_DISGUISE;
}
function disguiseDescription(disguise, female) {
    if (disguise.type === M_AP_MONSTER)
        return monsterTypeName(disguise.appearance, female);
    if (disguise.type === M_AP_FURNITURE) {
        const symbol = MAP_SYMBOLS[disguise.appearance];
        if (!symbol)
            throw new RangeError('Mimic meal has an invalid furniture appearance.');
        return symbol.name;
    }
    return requireObjectData(OBJECT_DESCRIPTIONS, disguise.appearance)
        || requireObjectData(OBJECT_NAMES, disguise.appearance) || 'something';
}
// Native glyph identity distinguishes two species even when both use 'f'.
function samePerceivedGlyph(left, right) {
    if (left === right)
        return true;
    if (!left || !right || left.kind !== right.kind)
        return false;
    switch (left.kind) {
        case 'monster': return right.kind === 'monster' && left.mnum === right.mnum;
        case 'object': return right.kind === 'object' && left.otyp === right.otyp;
        case 'terrain': return right.kind === 'terrain' && left.terrainName === right.terrainName;
        case 'trap': return right.kind === 'trap' && left.trapType === right.trapType;
        case 'effect':
        case 'engraving':
        case 'invisible':
        case 'nothing':
        case 'unexplored':
        case 'warning':
            return true;
    }
}
//# sourceMappingURL=monster_meal_mimicry.js.map