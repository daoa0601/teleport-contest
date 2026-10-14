// Opening and eating tins. C eat.c:start_tin(), opentin(), consume_tin().
import { armorSimpleName } from './armor.js';
import { currentAttribute, currentStrength, gainHeroStrength } from './attrib.js';
import { heroFingerName } from './body_parts.js';
import { triggerBoobyTrap } from './booby_trap.js';
import { A_DEX, GETOBJ_EXCLUDE, GETOBJ_SUGGEST, HEALTHY_TIN, HOMEMADE_TIN, RANDOM_TIN, ROTTEN_TIN, SPINACH_TIN, } from './const.js';
import { applyCorpsePostEffects, applyCorpsePreEffects } from './corpse_eating.js';
import { displayColorName, plineWithContinuation, randomDisplayMonsterName, } from './display.js';
import { nonrottingCorpse, vegetarianCorpse } from './food_traits.js';
import { eatingConducts, recordSpinachConsumption } from './food_conduct.js';
import { consumeFoodObject } from './food_lifecycle.js';
import { heroCanReachFloor } from './floor_reach.js';
import { stack_object } from './floor_object.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import { dropInventoryObjectAtHero } from './hero_drop.js';
import { startHeroVomiting } from './hero_illness.js';
import { heroSpecies } from './hero_species.js';
import { gainHeroNutrition } from './hunger.js';
import { inventoryItemDescription } from './invent.js';
import { chooseInventoryObject } from './inventory_prompt.js';
import { AD_POLY } from './monster_attack_types.js';
import { MONSTER_ATTACKS, MONSTER_BODY_META, MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_GENO, MONSTER_NAME, requireMonsterData } from './monster_data.js';
import { AXE, OBJECT_NAMES, PICK_AXE, TIN, TIN_OPENER } from './object_data.js';
import { makePlural } from './object_grammar.js';
import { observeObject } from './object_knowledge.js';
import { splitObjectStack, objectQuantity } from './object_stack.js';
import { ownedObjectName } from './objnam.js';
import { heroHasNoHands, heroIsVerySmall } from './polyself.js';
import { propertyIsActive } from './properties.js';
import { promptYesNo, promptYesNoQuit } from './query.js';
import { rn1, rn2, rnd } from './rng.js';
import { heroIsBlind, heroIsHallucinating } from './senses.js';
import { chargeAlteredUnpaidObject, costlySpot } from './shk.js';
import { setSlipperyHands } from './towel.js';
import { wieldTool } from './wield_tool.js';
const M1_METALLIVORE = 0x80000000;
const G_UNIQ = 0x1000;
const M2_PNAME = 0x00080000;
const PM_WIZARD = MONSTER_NAME.indexOf('Wizard of Yendor');
const PM_HIGH_CLERIC = MONSTER_NAME.indexOf('high cleric');
const PM_LONG_WORM_TAIL = MONSTER_NAME.indexOf('long worm tail');
const openingKnives = new Set([
    'dagger', 'silver dagger', 'elven dagger', 'orcish dagger',
    'athame', 'knife', 'stiletto', 'crysknife',
].map(name => OBJECT_NAMES.indexOf(name)));
// The last row is native tintxts' sentinel; random preparations exclude it.
const preparations = [
    { name: 'rotten', nutrition: -50 },
    { name: 'homemade', nutrition: 50, fodder: true },
    { name: 'soup made from', nutrition: 20, fodder: true },
    { name: 'french fried', nutrition: 40, greasy: true },
    { name: 'pickled', nutrition: 40, fodder: true },
    { name: 'boiled', nutrition: 50, fodder: true },
    { name: 'smoked', nutrition: 50, fodder: true },
    { name: 'dried', nutrition: 55, fodder: true },
    { name: 'deep fried', nutrition: 60, greasy: true },
    { name: 'szechuan', nutrition: 70, fodder: true },
    { name: 'broiled', nutrition: 80 },
    { name: 'stir fried', nutrition: 80, greasy: true },
    { name: 'sauteed', nutrition: 95 },
    { name: 'candied', nutrition: 100, fodder: true },
    { name: 'pureed', nutrition: 500, fodder: true },
    { name: '', nutrition: 0 },
];
export async function startTin(tin, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const weapon = state.uwep;
    let duration;
    let message;
    if (eatsMetal(state)) {
        duration = 0;
        message = 'You bite right into the metal tin...';
    }
    else if (heroHasNoHands(state) || heroIsVerySmall(state)) {
        await plineWithContinuation('You cannot handle the tin properly to open it.');
        return { started: false, completed: false, heroDied: false };
    }
    else if (tin.blessed) {
        duration = weapon?.otyp === TIN_OPENER && weapon.blessed ? 0 : rn2(2);
        if (!duration)
            message = 'The tin opens like magic!';
        else
            await plineWithContinuation('The tin seems easy to open.');
    }
    else if (weapon && (weapon.otyp === TIN_OPENER || openingKnives.has(weapon.otyp)
        || weapon.otyp === AXE || weapon.otyp === PICK_AXE)) {
        if (weapon.otyp === TIN_OPENER) {
            duration = rn2(weapon.cursed ? 3 : weapon.blessed ? 1 : 2);
            message = 'You easily open the tin.';
        }
        else
            duration = openingKnives.has(weapon.otyp) ? 3 : 6;
        await plineWithContinuation(`Using ${ownedObjectName(weapon, state, { capitalized: false })} you try to open the tin.`);
    }
    else {
        await plineWithContinuation('It is not so easy to open this tin.');
        if ((state.u.glibTurns ?? 0) > 0 || state.u.glib) {
            await plineWithContinuation(`The tin slips from your ${makePlural(heroFingerName(state))}.`);
            if (objectQuantity(tin) > 1)
                tin = splitTin(tin, state);
            if (tin.where === 'inventory')
                await dropInventoryObjectAtHero(tin, { state });
            else
                await stack_object(tin, state);
            return { started: false, completed: false, heroDied: !!state.program_state.gameover };
        }
        duration = rn1(1 + Math.trunc(500 / (currentAttribute(A_DEX, state) + currentStrength(state))), 10);
    }
    const opening = {
        key: 'open-tin', text: 'opening the tin', object: tin,
        tin, o_id: tin.o_id, reqtime: duration, usedtime: 0,
    };
    state.context.tin = opening;
    if (!duration) {
        if (message === undefined)
            throw new Error('Instant tin opening requires a message');
        await consumeTin(message, { state });
    }
    else
        state._occupation = opening;
    state.context.move = state.program_state.gameover ? 0 : 1;
    return { started: true, completed: duration === 0, heroDied: !!state.program_state.gameover };
}
export async function continueTinOpening(opening, state = game) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const tin = state.context.tin?.tin;
    const available = tin && (tin.where === 'inventory'
        || tin.where === 'floor' && tin.ox === state.u.ux && tin.oy === state.u.uy
            && state.level.objects[tin.ox]?.[tin.oy]?.includes(tin)
            && heroCanReachFloor(state, { checkPit: true }));
    if (!available) {
        state._occupation = null;
        state.context.move = 1;
        return true;
    }
    if (opening.usedtime++ >= 50) {
        await plineWithContinuation('You give up your attempt to open the tin.');
        state._occupation = null;
    }
    else if (opening.usedtime >= opening.reqtime) {
        await consumeTin('You succeed in opening the tin.', { state });
        state._occupation = null;
    }
    state.context.move = state.program_state.gameover ? 0 : 1;
    return true;
}
// C eat.c:Popeye(): do not interrupt opening a tin which might cure the
// current threat. Unknown contents are given the benefit of the doubt.
export function openingTinMaySaveHero(threat, state = game) {
    if (state._occupation?.key !== 'open-tin')
        return false;
    const tin = state.context.tin?.tin;
    if (!tin)
        return false;
    const available = tin.where === 'inventory'
        || tin.where === 'floor' && tin.ox === state.u.ux && tin.oy === state.u.uy
            && state.level?.objects[tin.ox]?.[tin.oy]?.includes(tin)
            && heroCanReachFloor(state, { checkPit: true });
    if (!available)
        return false;
    if (!tin.known)
        return true;
    const species = tinSpecies(tin);
    switch (threat) {
        case 'hunger': return species !== -1 || tin.spe === 1;
        case 'stoned':
            return species >= 0 && (MONSTER_NAME[species] === 'lizard'
                || !!(requireMonsterData(MONSTER_FLAGS1, species) & 0x08000000));
        case 'slimed':
            return species >= 0 && (!!(requireMonsterData(MONSTER_FLAGS2, species) & 0x00004000)
                || requireMonsterData(MONSTER_ATTACKS, species).some(([, damage]) => damage === AD_POLY));
        case 'sick':
        case 'vomiting': return false;
    }
}
export async function useTinOpener(tool, { state = game, swapWeapons } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    if (!state.inventory.some(object => object.otyp === TIN)) {
        await plineWithContinuation('You have no tin to open.');
        return { usedTime: false, cancelled: false, heroDied: false };
    }
    let usedTime = false;
    if (tool !== state.uwep) {
        if (tool.cursed && tool.bknown && await promptYesNoQuit(`Really wield ${inventoryItemDescription(tool)}?`) !== 'y')
            return { usedTime, cancelled: true, heroDied: false };
        const wielded = await wieldTool(tool, 'use', { swapWeapons }, state);
        if (!wielded.ready || state.program_state.gameover)
            return { usedTime, cancelled: false, heroDied: !!state.program_state.gameover };
        usedTime = true;
    }
    const tin = await chooseInventoryObject('open', object => object?.otyp === TIN ? GETOBJ_SUGGEST : GETOBJ_EXCLUDE);
    if (!tin)
        return { usedTime, cancelled: true, heroDied: false };
    const result = await startTin(tin, { state });
    return { usedTime: true, cancelled: false, heroDied: result.heroDied };
}
export async function useUpTin(tin, { state = game } = {}) {
    requirePlayingGame(state);
    await consumeFoodObject(tin, { state });
    if (state.context.tin) {
        state.context.tin.tin = null;
        state.context.tin.o_id = 0;
    }
}
async function consumeTin(message, { state }) {
    // Metal has already been swallowed when corpse effects change the form.
    const alwaysEat = eatsMetal(state);
    let tin = currentTin(state);
    const variety = tinVariety(tin);
    if (tin.otrapped || tin.cursed && variety !== HOMEMADE_TIN && rn2(8) === 0) {
        if (await triggerBoobyTrap('tin', { state }))
            return;
        tin = await costlyTin('destroy', state);
        await useUpTin(tin, { state });
        return;
    }
    await plineWithContinuation(message);
    if (variety === SPINACH_TIN) {
        await consumeSpinach(tin, alwaysEat, state);
        return;
    }
    const species = tinSpecies(tin);
    if (species === -1) {
        await plineWithContinuation(heroIsHallucinating(state)
            ? `It's full of ${rn2(2) ? 'air elemental souffle' : 'dehydrated water'}.`
            : 'It turns out to be empty.');
        observeObject(tin, state);
        tin.known = true;
        tin = await costlyTin('open', state);
        await useUpTin(tin, { state });
        if (alwaysEat)
            await gainHeroNutrition(5, { state });
        return;
    }
    const smell = tinSmell(species, state);
    if (!alwaysEat) {
        await plineWithContinuation(`It smells like ${smell}.`);
        if (await promptYesNo('Eat it?') === 'n') {
            await discardTin(tin, state, !heroIsHallucinating(state));
            return;
        }
    }
    state.context.victual = null;
    const preparation = tinPreparation(variety);
    await plineWithContinuation(`You consume ${preparation.name} ${requireMonsterData(MONSTER_NAME, species)}.`);
    await eatingConducts(species, { state });
    observeObject(tin, state);
    tin.known = true;
    tin = await costlyTin('open', state);
    const pre = await applyCorpsePreEffects(species, { state, tin });
    if (pre.heroDied || state.program_state.gameover || !state.context.tin?.tin)
        return;
    const post = await applyCorpsePostEffects(species, { state, tin });
    if (post.heroDied || state.program_state.gameover || !state.context.tin?.tin)
        return;
    if (preparation.nutrition < 0)
        startHeroVomiting({ state, turns: rn1(15, 10) });
    else {
        const nutrition = (variety === HOMEMADE_TIN
            ? Math.min(preparation.nutrition, requireMonsterData(MONSTER_BODY_META, species)[1])
            : preparation.nutrition) + (alwaysEat ? 5 : 0);
        await useUpTin(tin, { state });
        await gainHeroNutrition(nutrition, { state });
        if (state.program_state.gameover)
            return;
        tin = null;
    }
    if (preparation.greasy) {
        const old = state.u.glibTurns || 0;
        setSlipperyHands(old + rn1(11, 5), state);
        const fingers = state.uarmg ? armorSimpleName(state.uarmg, state) : makePlural(heroFingerName(state));
        await plineWithContinuation(`Eating ${preparation.name} food made your ${fingers} ${old ? 'even more' : 'very'} slippery.`);
    }
    if (tin)
        await useUpTin(tin, { state });
}
async function consumeSpinach(tin, alwaysEat, state) {
    await plineWithContinuation(tin.cursed
        ? `It contains some decaying${heroIsBlind(state) ? '' : ` ${displayColorName('green', state)}`} substance.`
        : 'It contains spinach.');
    if (!tin.cursed) {
        observeObject(tin, state);
        tin.known = true;
    }
    if (!alwaysEat && await promptYesNo('Eat it?') === 'n') {
        await discardTin(tin, state, false);
        return;
    }
    recordSpinachConsumption({ state });
    if (!tin.cursed) {
        const fixed = state.u.fixedAbilities || propertyIsActive('sustainAbility', state);
        const character = heroIsHallucinating(state) ? "Swee'pea"
            : !fixed ? 'Popeye' : state.flags.female ? 'Olive Oyl' : 'Bluto';
        await plineWithContinuation(`This makes you feel like ${character}!`);
    }
    await gainHeroStrength(tin, 0, { state, giveMessage: false });
    tin = await costlyTin('open', state);
    const nutrition = (tin.blessed ? 600 : tin.cursed ? 200 + rnd(400) : 400 + rnd(200))
        + (alwaysEat ? 5 : 0);
    await useUpTin(tin, { state });
    await gainHeroNutrition(nutrition, { state });
}
async function discardTin(tin, state, learnContents) {
    if (state.flags.verbose !== false)
        await plineWithContinuation('You discard the open tin.');
    if (learnContents) {
        observeObject(tin, state);
        tin.known = true;
    }
    tin = await costlyTin('open', state);
    await useUpTin(tin, { state });
}
async function costlyTin(alteration, state) {
    const opening = currentTinOpening(state);
    let tin = currentTin(state);
    const billable = tin.where === 'inventory' ? tin.unpaid
        : costlySpot(tin.ox, tin.oy, state) && !tin.no_charge;
    if (billable) {
        if (objectQuantity(tin) > 1) {
            tin = splitTin(tin, state);
            opening.tin = tin;
            opening.o_id = tin.o_id;
        }
        await chargeAlteredUnpaidObject(tin, alteration, state);
    }
    return tin;
}
function splitTin(tin, state) {
    const split = splitObjectStack(tin, 1, state);
    if (!split)
        throw new Error(`Tin stack ${tin.o_id} could not be split`);
    return split;
}
function eatsMetal(state) {
    return !!(requireMonsterData(MONSTER_FLAGS1, heroSpecies(state)) & M1_METALLIVORE);
}
function tinSmell(species, state) {
    if (['cockatrice', 'chickatrice'].includes(requireMonsterData(MONSTER_NAME, species))
        && (propertyIsActive('stoneResistance', state) || heroIsHallucinating(state)))
        return 'chicken';
    if (heroIsHallucinating(state))
        return makePlural(randomDisplayMonsterName());
    if (species === PM_WIZARD || requireMonsterData(MONSTER_GENO, species) & G_UNIQ
        && !(requireMonsterData(MONSTER_FLAGS2, species) & M2_PNAME)
        && species !== PM_HIGH_CLERIC && species !== PM_LONG_WORM_TAIL)
        return `the ${requireMonsterData(MONSTER_NAME, species)}`;
    return requireMonsterData(MONSTER_FLAGS2, species) & M2_PNAME ? requireMonsterData(MONSTER_NAME, species) : makePlural(requireMonsterData(MONSTER_NAME, species));
}
export function tinVariety(tin, display = false) {
    const species = tinSpecies(tin);
    let variety = tin.spe === 1 ? SPINACH_TIN : tin.cursed ? ROTTEN_TIN
        : tin.spe < 0 ? -tin.spe - 1 : rn2(preparations.length - 1);
    if (!display && variety === HOMEMADE_TIN && !tin.blessed && rn2(7) === 0)
        variety = ROTTEN_TIN;
    if (variety === ROTTEN_TIN && species >= 0 && nonrottingCorpse(species))
        variety = HOMEMADE_TIN;
    return variety;
}
export function setTinVariety(tin, mode = RANDOM_TIN) {
    if (mode === SPINACH_TIN) {
        tin.corpsenm = -1;
        tin.spe = 1;
        return;
    }
    const species = tinSpecies(tin);
    if (mode === HEALTHY_TIN && (species < 0 || !vegetarianCorpse(species))) {
        tin.corpsenm = -1;
        tin.spe = 1;
        return;
    }
    let variety;
    if (mode === HEALTHY_TIN) {
        variety = tinVariety(tin);
        if (variety < 0 || variety >= preparations.length)
            variety = ROTTEN_TIN;
        while (variety === ROTTEN_TIN && !tin.cursed || !tinPreparation(variety).fodder)
            variety = rn2(preparations.length - 1);
    }
    else if (mode >= 0 && mode < preparations.length - 1)
        variety = mode;
    else {
        variety = rn2(preparations.length - 1);
        if (variety === ROTTEN_TIN && species >= 0 && nonrottingCorpse(species))
            variety = HOMEMADE_TIN;
    }
    tin.spe = -(variety + 1);
}
// Native tin_variety_txt(): preparation labels are accepted only as whole
// prefixes followed by a space and the monster that supplies the meat.
export function parseTinPreparation(text) {
    for (const [variety, preparation] of preparations.entries()) {
        if (preparation.name && text.toLowerCase().startsWith(`${preparation.name} `))
            return { variety, remaining: text.slice(preparation.name.length + 1) };
    }
    return { variety: null, remaining: text };
}
export function tinDetails(tin, species = tinSpecies(tin), { state = game } = {}) {
    const variety = tinVariety(tin, true);
    if (variety === SPINACH_TIN)
        return 'tin of spinach';
    if (species === -1)
        return 'empty tin';
    const contents = vegetarianCorpse(species) ? requireMonsterData(MONSTER_NAME, species) : `${requireMonsterData(MONSTER_NAME, species)} meat`;
    if ((tin.cknown || tin.overrideIdentified || state.iflags?.override_ID) && tin.spe < 0) {
        const name = tinPreparation(variety).name;
        return variety === ROTTEN_TIN || variety === HOMEMADE_TIN
            ? `${name} tin of ${contents}` : `tin of ${name} ${contents}`;
    }
    return `tin of ${contents}`;
}
function currentTinOpening(state) {
    const opening = state.context.tin;
    if (!opening)
        throw new Error('No tin is being opened');
    return opening;
}
function currentTin(state) {
    const tin = currentTinOpening(state).tin;
    if (!tin)
        throw new Error('The tin being opened has already been consumed');
    return tin;
}
function tinSpecies(tin) {
    if (tin.corpsenm === undefined)
        throw new Error(`Tin ${tin.o_id} has no contents species`);
    return tin.corpsenm;
}
function tinPreparation(variety) {
    const preparation = preparations[variety];
    if (!preparation)
        throw new RangeError(`Invalid tin preparation ${variety}`);
    return preparation;
}
//# sourceMappingURL=tin.js.map