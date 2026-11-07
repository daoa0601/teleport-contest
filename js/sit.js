import { stack_object, delobj } from './invent.js';
import { COIN_CLASS } from './objclass.js';
import { eggTypeFromParent } from './mon.js';
// #sit and the immediate consequences of sitting down.
// C ref: sit.c dosit(), take_gold(), lay_an_egg(), throne_sit_effect(),
// special_throne_effect(), rndcurse(), and attrcurse(); the hero's carried
// gold helpers (money_cnt/addinv/freeinv/splitobj refs) live here too.
import { objectMaterial, observeObject } from './o_init.js';
import { A_CON, A_MAX, A_STR, A_WIS, ALTAR, DRAWBRIDGE_DOWN, EYE, FOUNTAIN, GRAVE, HEAD, Is_waterlevel, is_hole, is_pit, LADDER, Luck, ROOM, SINK, SPIKED_PIT, STAIRS, THRONE, TT_BEARTRAP, TT_BURIEDBALL, TT_INFLOOR, TT_LAVA, TT_PIT, TT_WEB, FOOT } from './const.js';
import { adjustAttribute, attributeChangeMessage, changeHeroLuck, exerciseAttribute } from './attrib.js';
import { plineWithContinuation, plineWithContinuation as pline, formatFeltMessage } from './pline.js';
import { game, requireLiveGame, requirePlayingGame, requireInitializedGame } from './gstate.js';
import { waterDamageObject, dotrap } from './trap.js';
import { doGenocide, GENOCIDE_ON_THRONE, exerciseScrollWisdom, removeCurseEffect } from './read.js';
import { morehungry } from './eat.js';
import { heroCanReachFloor } from './engrave.js';
import { burnAwayHeroSlime, heroGoldAmount, loseHeroHp } from './hack.js';
import { dropObjectAtHero, healHeroLegs, scheduleLevelChange } from './do.js';
import { identifyPack, useUpFloorObject } from './invent.js';
import { removeWornHeroItem } from './steal.js';
import { encumber_msg, markJustPicked } from './pickup.js';
import { heroIsDeaf, heroIsHallucinating, heroIsBlind } from './senses.js';
import { curseObject, unblessObjectState, adjustObjectLightAfterBlessing, mksobj, set_corpsenm, objectWeight, splitObjectStack, unlinkObject, createObjectBase, nextIdent } from './mkobj.js';
import { MONSTER_SYMBOL } from './monster_data.js';
import { SPE_REMOVE_CURSE, CHEST, CORPSE, CREAM_PIE, EGG, GOLD_PIECE, LARGE_BOX, TOWEL, WATER_WALKING_BOOTS, oc_nutrition } from './object_data.js';
import { makePlural, verbForSubject, definiteName, objectCombatName, objectNameIsPlural, ownedObjectAction } from './objnam.js';
import { displayColorName, displayLiquidName, monsterName } from './do_name.js';
import { monsterPossessive, lays_eggs, monsterIsAmorphous, monsterIsHumanoid, monsterIsSlithy, is_prince, eyecount, eggs_in_water, } from './mondata.js';
import { surfaceName } from './dungeon.js';
import { isIceAt, isLavaAt, isPoolAt } from './dbridge.js';
import { heroIsPolymorphed, polymorphHero, body_part, heroSpecies, heroFormHidesWithoutCover, heroMonsterForm, heroFormSticks } from './polyself.js';
import { altarWrath } from './pray.js';
import { d, rnd, rn1, rn2 } from './rng.js';
import { splitSittingGremlin } from './fountain.js';
import { makeConfused, makeBlinded, cureHeroSickness, setSlipperyHands } from './potion.js';
import { heroHasHalfSpellDamage, makeWish } from './zap.js';
import { artifactById } from './artifact.js';
import { mapLevel } from './detect.js';
import { map_background, newsym, newsym_force, see_monsters, shieldeff, refreshHeroSeeing } from './display.js';
import { finishHeroDeath } from './end.js';
import { loseHeroExperience } from './exper.js';
import { heroHasDrainResistance } from './do_wear.js';
import { dropCursedSecondaryWeapon } from './wield.js';
import { objectLightRadius } from './light.js';
import { promptYesNo } from './query.js';
import { getLine } from './windows.js';
import { monsterSaddle } from './steed.js';
import { teleportHero } from './teleport.js';
import { cansee } from './vision.js';
import { aggravateMonsters } from './wizard.js';
import { msummon } from './minion.js';
import { makemonNear } from './mklev.js';
import { courtMonsterType } from './mkroom.js';
import { grantIntrinsicProperty, hasPermanentIntrinsicProperty, removePermanentIntrinsicProperty } from './properties.js';
import { syncHeroInvisibility } from './hero_invisibility.js';
const CLOTH = 6;
const S_DRAGON = 30;
const PM_GREMLIN = 40;
const PM_TRAPPER = 99;
const PM_FIRE_ELEMENTAL = 155;
const PM_GIANT_EEL = 319;
const PM_ELECTRIC_EEL = 320;
const PM_SALAMANDER = 329;
const S_VAMPIRE = 48;
const CURSEABLE_INTRINSICS = Object.freeze([
    ['fireResistance', 'warmer.'],
    ['teleportation', 'less jumpy.'],
    ['poisonResistance', 'a little sick!'],
    ['telepathy', null],
    ['coldResistance', 'cooler.'],
    ['invisible', 'paranoid.'],
    ['seeInvisible', null],
    ['fast', 'slower.'],
    ['stealth', 'clumsy.'],
    ['protection', 'vulnerable.'],
    ['aggravateMonster', 'less attractive.'],
]);
// Part of C sit.c:dosit(): choose the hero's sitting anatomy.
function formIsHumanoid() {
    return heroMonsterForm(game) == null
        || monsterIsHumanoid(heroMonsterForm(game) ?? -1);
}
// Port only: read object quantities from the runtime representation.
function objectQuantity(object) {
    return object?.quan ?? object?.quantity ?? 1;
}
// Part of C sit.c:dosit(), sit.c:lay_an_egg(): check the current form's aquatic egg laying.
function waterEggLayer() {
    const form = heroMonsterForm(game);
    return form !== null && eggs_in_water(form);
}
// C sit.c:take_gold(). Contained coins are not exposed to the effect.
export async function takeHeroGold(state = game) {
    let lostMoney = false;
    for (const object of [...state.inventory]) {
        if (object.oclass !== COIN_CLASS)
            continue;
        lostMoney = true;
        await removeWornHeroItem(object, state);
        await delobj(object, state);
    }
    await pline(lostMoney
        ? 'You notice you have no gold!'
        : formatFeltMessage('a strange sensation.', state));
    if (lostMoney)
        state.context.botl = true;
}
// Port only: read a nonnegative carried coin quantity.
export function heroGoldQuantity(object) {
    return Math.max(0, Math.trunc(object?.quan ?? object?.quantity ?? 0));
}
// Part of C mkobj.c:weight(): compute coin-stack weight.
function coinWeight(amount) {
    return Math.max(1, Math.trunc((amount + 50) / 100));
}
// Port only: synchronize the runtime fields of a coin stack.
function normalizeGoldObject(object, amount = heroGoldQuantity(object)) {
    object.otyp = GOLD_PIECE;
    object.oclass = COIN_CLASS;
    object.invlet = '$';
    object.name = 'gold piece';
    object.plural = 'gold pieces';
    object.quan = object.quantity = amount;
    object.owt = coinWeight(amount);
    return object;
}
// Port only: find the hero's coin stack in the inventory array.
export function heroGoldObject(state) {
    return (state?.inventory || []).find(object => object?.otyp === GOLD_PIECE || object?.oclass === COIN_CLASS) || null;
}
// Port only: merge coin stacks in the runtime inventory representation.
export function addHeroGoldObject(state, incoming) {
    if (!incoming)
        return { object: heroGoldObject(state), merged: false };
    const amount = heroGoldQuantity(incoming);
    if (!amount)
        return { object: heroGoldObject(state), merged: false };
    state.context.botl = true;
    const existing = heroGoldObject(state);
    if (existing && existing !== incoming) {
        const total = heroGoldQuantity(existing) + amount;
        normalizeGoldObject(existing, total);
        incoming.where = 'gone';
        incoming.ox = incoming.oy = 0;
        incoming.quan = incoming.quantity = 0;
        return { object: markJustPicked(existing), merged: true };
    }
    normalizeGoldObject(incoming, amount);
    incoming.where = 'inventory';
    incoming.container = null;
    incoming.ox = incoming.oy = 0;
    incoming.owornmask = incoming.owornmask ?? 0;
    state.inventory ||= [];
    if (!state.inventory.includes(incoming))
        state.inventory.unshift(incoming);
    return { object: markJustPicked(incoming), merged: false };
}
// Port only: update or construct the hero's runtime coin stack.
export function setHeroGoldAmount(state, amount) {
    amount = Math.max(0, Math.trunc(amount ?? 0));
    let object = heroGoldObject(state);
    if (amount !== heroGoldAmount(state))
        state.context.botl = true;
    if (!amount) {
        if (object) {
            state.inventory = (state.inventory || [])
                .filter(candidate => candidate !== object);
            if (state.uquiver === object)
                state.uquiver = null;
            if (state.u?.uquiver === object)
                state.u.uquiver = null;
            object.ready = false;
            object.owornmask = 0;
            object.where = 'gone';
            object.quan = object.quantity = 0;
        }
        return null;
    }
    if (!object) {
        object = normalizeGoldObject({
            ...createObjectBase(GOLD_PIECE, nextIdent(), state.moves),
            where: 'inventory',
            worn: false,
            wielded: false,
            alternate: false,
            ready: false,
            owornmask: 0,
            contents: [],
            objectTimers: [],
            timed: 0,
        }, amount);
        state.inventory ||= [];
        state.inventory.unshift(object);
    }
    normalizeGoldObject(object, amount);
    return object;
}
// Port only: detach a requested coin quantity through shared ownership operations.
export function detachHeroGold(state, requested = null) {
    const object = heroGoldObject(state);
    if (!object)
        return null;
    const amount = heroGoldQuantity(object);
    const count = requested === null
        ? amount : Math.max(1, Math.min(Math.trunc(requested), amount));
    const detached = count < amount ? splitObjectStack(object, count, state) : object;
    if (!detached)
        throw new Error('A gold stack must yield the requested coins.');
    unlinkObject(detached, state);
    state.context.botl = true;
    if (state.uquiver === detached)
        state.uquiver = null;
    if (state.u?.uquiver === detached)
        state.u.uquiver = null;
    detached.ready = false;
    detached.owornmask = 0;
    return detached;
}
// Port only: read a valid current hero species index.
function currentForm() {
    const species = game.u.umonnum;
    return species !== undefined && Number.isInteger(species) ? species : null;
}
// C sit.c:special_throne_effect() — cases 9-11 read the Luck macro
// (you.h:Luck), case 6 reads u.uluck alone.
// Part of C sit.c:throne_sit_effect(): choose Vlad's special throne effects.
function inVladsTower() {
    return (game.u.uz ? game.dungeons[game.u.uz.dnum]?.dname : undefined) === "Vlad's Tower";
}
// Part of C sit.c:throne_sit_effect(), sit.c:special_throne_effect(): replace a vanished throne with room terrain.
async function removeThrone(x, y) {
    const location = game.level?.at?.(x, y);
    if (!location)
        return;
    location.typ = ROOM;
    location.flags = 0;
    location.looted = 0;
    await map_background(x, y, false);
    await newsym_force(x, y);
}
// Port only: publish shared attribute changes and refresh carrying capacity.
async function announceAttributeChange(attribute, amount, conditional) {
    const result = adjustAttribute(attribute, amount, game);
    if (conditional && !result.changed)
        return result;
    if (!result.changed && !result.blockedByDunceCap
        && game.flags?.verbose === false)
        return result;
    const message = attributeChangeMessage(attribute, result);
    if (message)
        await plineWithContinuation(message);
    if (result.changed && game._moveloopStarted
        && (attribute === A_STR || attribute === A_CON))
        await encumber_msg(game);
    return result;
}
// Part of C sit.c:throne_sit_effect(): restore health and cure ailments.
async function healHeroCompletely() {
    const game = requireInitializedGame();
    const hero = game.u;
    if (heroIsPolymorphed(game)) {
        if ((hero.mh ?? 0) >= (hero.mhmax ?? 0) - 5)
            hero.mhmax = (hero.mhmax ?? 0) + 4;
        hero.mh = hero.mhmax;
    }
    if ((hero.uhp ?? 0) >= (hero.uhpmax ?? 0) - 5) {
        hero.uhpmax = (hero.uhpmax ?? 0) + 4;
        hero.uhppeak = Math.max(hero.uhppeak ?? 0, hero.uhpmax);
    }
    hero.uhp = hero.uhpmax;
    hero.ucreamed = 0;
    await makeBlinded(0);
    cureHeroSickness(game);
    await healHeroLegs(game);
    game.context.botl = true;
}
// Part of C sit.c:throne_sit_effect(): summon a royal audience.
async function summonCourt(x, y) {
    let count = rnd(10);
    const title = game.flags?.female ? 'Dame' : 'Sire';
    await plineWithContinuation('A voice echoes:');
    await plineWithContinuation(`"Thine audience hath been summoned, ${title}!"`);
    while (count-- > 0)
        await makemonNear(courtMonsterType(), x, y);
}
// Part of C sit.c:throne_sit_effect(): grant sight of invisible creatures.
async function grantSeeInvisible() {
    const hero = game.u;
    if (!heroIsBlind()) {
        await plineWithContinuation('Your vision becomes clear.');
    }
    else {
        const count = eyecount(heroSpecies());
        if (count) {
            const eyes = count === 1 ? body_part(EYE) : makePlural(body_part(EYE));
            await plineWithContinuation(`Your ${eyes} ${verbForSubject(eyes, 'tingle')}...`);
        }
        else {
            await plineWithContinuation(`You have a very strange feeling in your ${body_part(HEAD)}.`);
        }
    }
    grantIntrinsicProperty('seeInvisible', 'outside', game);
    await newsym(hero.ux, hero.uy);
}
// Part of C sit.c:throne_sit_effect(): dispatch the thirteen ordinary throne effects.
async function normalThroneEffect(effect, x, y, { chooseTeleportDestination }) {
    switch (effect) {
        case 1:
            await announceAttributeChange(rn2(A_MAX), -rn1(4, 3), false);
            await loseHeroHp(rnd(10), 'cursed throne');
            break;
        case 2:
            await announceAttributeChange(rn2(A_MAX), 1, false);
            break;
        case 3: {
            const resistant = !!(game.u.shockResistance);
            await plineWithContinuation(`A${resistant ? 'n' : ' massive'} electric shock shoots through your body!`);
            await loseHeroHp(resistant ? rnd(6) : rnd(30), 'electric chair');
            await exerciseAttribute(A_CON, false);
            break;
        }
        case 4:
            await plineWithContinuation(formatFeltMessage('much, much better!'));
            await healHeroCompletely();
            break;
        case 5:
            await takeHeroGold();
            break;
        case 6:
            // C sit.c:106 reads u.uluck without the carried luck bonus.
            if ((game.u.uluck ?? 0) + rn2(5) < 0) {
                await plineWithContinuation(formatFeltMessage('your luck is changing.'));
                changeHeroLuck(1);
            }
            else {
                await makeWish();
            }
            break;
        case 7:
            await summonCourt(x, y);
            break;
        case 8: {
            const title = game.flags?.female ? 'Dame' : 'Sire';
            await plineWithContinuation('A voice echoes:');
            await plineWithContinuation(`"By thine Imperious order, ${title}..."`);
            await doGenocide(1 | GENOCIDE_ON_THRONE, { finishHeroDeath });
            break;
        }
        case 9:
            await plineWithContinuation('A voice echoes:');
            await plineWithContinuation('"A curse upon thee for sitting upon this most holy throne!"');
            if (Luck(game.u) > 0) {
                await makeBlinded((game.u.blindTurns ?? 0) + rn1(100, 250));
                changeHeroLuck(Luck(game.u) > 1 ? -rnd(2) : -1);
            }
            else {
                await rndcurse();
            }
            break;
        case 10:
            if (Luck(game.u) < 0
                || hasPermanentIntrinsicProperty('seeInvisible', game)) {
                if (game.level?.flags?.nommap) {
                    await plineWithContinuation('A terrible drone fills your head!');
                    await makeConfused((game.u.confusionTurns ?? 0) + rnd(30), { talk: false });
                }
                else {
                    await plineWithContinuation('An image forms in your mind.');
                    await mapLevel();
                }
            }
            else {
                await grantSeeInvisible();
            }
            break;
        case 11:
            if (Luck(game.u) < 0) {
                await plineWithContinuation(formatFeltMessage('threatened.'));
                aggravateMonsters(game);
            }
            else {
                await plineWithContinuation(formatFeltMessage('a wrenching sensation.'));
                await teleportHero(chooseTeleportDestination
                    ? { chooseDestination: chooseTeleportDestination } : {});
            }
            break;
        case 12:
            await plineWithContinuation('You are granted an insight!');
            if (game.inventory?.length)
                await identifyPack(rn2(5), false);
            break;
        case 13:
            await plineWithContinuation('Your mind turns into a pretzel!');
            await makeConfused((game.u.confusionTurns ?? 0) + rn1(7, 16), { talk: false });
            break;
    }
}
// C sit.c:throne_sit_effect()
export async function throneSitEffect({ gotoLevel = null, chooseTeleportDestination = null, } = {}) {
    const x = game.u?.ux;
    const y = game.u?.uy;
    const special = inVladsTower();
    if (rnd(6) > 4) {
        let effect = rnd(13);
        if (game.flags?.debug && !game.flags?.debug_fuzzer) {
            const answer = await getLine('Throne sit effect (1..13) [0=random]', () => true);
            if (answer === null) {
                await plineWithContinuation('Never mind.');
                return;
            }
            const requested = Number.parseInt(answer, 10);
            if (requested >= 1 && requested <= 13)
                effect = requested;
        }
        if (special) {
            await specialThroneEffect(effect, x, y, { gotoLevel });
            return;
        }
        await normalThroneEffect(effect, x, y, {
            chooseTeleportDestination,
        });
        if (game.program_state.gameover)
            return;
    }
    else {
        const prince = is_prince(currentForm() ?? -1);
        const handOfElbereth = !!game.u?.uevent?.uhand_of_elbereth;
        await plineWithContinuation(formatFeltMessage(prince || handOfElbereth ? 'very comfortable here.' : 'somehow out of place...'));
    }
    if (!special && !rn2(3)) {
        if (game.flags?.debug
            && await promptYesNo('Analyze throne?', 'n') !== 'y')
            return;
        await removeThrone(x, y);
        await plineWithContinuation(`The throne ${cansee(x, y) ? 'vanishes' : 'has vanished'} in a puff of logic.`);
    }
}
// C sit.c:special_throne_effect()
async function specialThroneEffect(effect, x, y, { gotoLevel }) {
    const game = requireInitializedGame();
    switch (effect) {
        case 1:
        case 2:
        case 3:
        case 4:
            await makeWish();
            await removeThrone(x, y);
            await plineWithContinuation('The throne disintegrates, having spent its power.');
            break;
        case 5:
            await plineWithContinuation('Sitting on the throne was a terrible experience.');
            if (!heroHasDrainResistance(game)) {
                if (await loseHeroExperience('a bad experience sitting on a throne'))
                    return;
                if ((game.u.ulevelmax ?? game.u.ulevel) > game.u.ulevel)
                    game.u.ulevelmax--;
            }
            break;
        case 6:
            await plineWithContinuation('A greasy liquid sprays all over you!');
            for (const object of game.inventory || []) {
                if (object.oclass !== COIN_CLASS)
                    object.greased = true;
            }
            setSlipperyHands(rn1(101, 100));
            break;
        case 7:
            await attrcurse();
            await plineWithContinuation('The throne somehow seems to be amused.');
            break;
        case 8: {
            const gehennom = game.dungeons?.findIndex(dungeon => dungeon?.dname === 'Gehennom');
            if (game.u?.uhave?.amulet) {
                await plineWithContinuation(formatFeltMessage('extremely disoriented for a moment.'));
            }
            else if (gehennom >= 0) {
                if (typeof gotoLevel !== 'function') {
                    throw new TypeError('Vlad throne travel needs a level mover');
                }
                scheduleLevelChange([{
                        dnum: gehennom,
                        dlevel: Math.max(1, (game.dungeons[gehennom]?.num_dunlevs ?? 1) - 1),
                    }, {
                        arrival: 'random',
                        postMessage: 'You feel extremely out of place.',
                    }], gotoLevel);
            }
            break;
        }
        case 9:
            await plineWithContinuation('The throne seeems to be calling for help!');
            await msummon(null);
            await msummon(null);
            await msummon(null);
            break;
        case 10: {
            // C installs a temporary HConfusion value for the blessed spell.
            const previousConfusion = game.u.confusionTurns;
            game.u.confusionTurns = 1;
            try {
                await applyRemoveCurseSpell({ blessed: true });
            }
            finally {
                if (previousConfusion === undefined)
                    delete game.u.confusionTurns;
                else
                    game.u.confusionTurns = previousConfusion;
            }
            break;
        }
        case 11:
            if (MONSTER_SYMBOL[currentForm() ?? -1] === S_VAMPIRE) {
                await plineWithContinuation(formatFeltMessage('unworthy.'));
            }
            else {
                await plineWithContinuation('This throne was not meant for those such as you!');
                await plineWithContinuation(formatFeltMessage('a change coming over you.'));
                await polymorphHero();
            }
            break;
        case 12: {
            await plineWithContinuation('The throne is covered in acid!');
            const resistant = !!(game.u.acidResistance);
            await loseHeroHp(resistant ? rnd(16) : rnd(80), 'acidic chair');
            await exerciseAttribute(A_CON, false);
            break;
        }
        case 13:
            await plineWithContinuation('As you sit on the throne, your body and mind start to warp.');
            for (let attribute = 0; attribute < A_MAX; attribute++) {
                await announceAttributeChange(attribute, rn2(5) - 2, true);
            }
            break;
    }
}
// Part of C sit.c:special_throne_effect(): case 10, sends seffects() a zeroobj
// SPE_REMOVE_CURSE spellbook with temporary confusion, so the fake spell
// has no inventory identity or creation effects but still passes through
// seffects' Wisdom gain. trap.c:4440's magic trap uses the same entry.
export async function applyRemoveCurseSpell({ state = game, blessed = false, cursed = false, } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    await exerciseScrollWisdom(SPE_REMOVE_CURSE, state);
    await removeCurseEffect({
        source: { otyp: SPE_REMOVE_CURSE, blessed, cursed },
        state,
        publish: plineWithContinuation,
    });
    return { known: false, consumed: false, heroDied: !!state.program_state.gameover };
}
// C sit.c:lay_an_egg().
async function layEgg() {
    const form = heroMonsterForm(game);
    if (form === null)
        throw new Error('Laying an egg requires an egg-laying monster form.');
    if (game.flags?.female !== true) {
        await pline(`${heroIsHallucinating()
            ? 'You may think you are a platypus, but a male still'
            : 'Males'} can't lay eggs!`);
        return false;
    }
    const nutrition = oc_nutrition(EGG) ?? 0;
    if ((game.u?.uhunger ?? 0) < nutrition) {
        await pline("You don't have enough energy to lay an egg.");
        return false;
    }
    if (waterEggLayer()) {
        if (!(game.underwater || game.u?.uinwater
            || Is_waterlevel(game.u.uz))) {
            await pline('A splash tetra you are not.');
            return false;
        }
        if (form === PM_GIANT_EEL || form === PM_ELECTRIC_EEL) {
            await pline('You yearn for the Sargasso Sea.');
            return false;
        }
    }
    const egg = await mksobj(EGG, false, false);
    egg.spe = 1;
    egg.quan = egg.quantity = 1;
    set_corpsenm(egg, eggTypeFromParent(form));
    egg.known = true;
    egg.owt = objectWeight(egg);
    observeObject(egg);
    await pline(`You ${waterEggLayer() ? 'spawn' : 'lay'} an egg.`);
    await dropObjectAtHero(egg);
    if (egg.where === 'floor')
        await stack_object(egg);
    await morehungry(nutrition);
    return !game.program_state.gameover;
}
// Part of C sit.c:dosit(): sitting on the floor's top object.
async function sitOnObject(object) {
    if (MONSTER_SYMBOL[heroMonsterForm(game) ?? -1] === S_DRAGON
        && object.oclass === COIN_CLASS) {
        const wealth = objectQuantity(object) + heroGoldAmount(game);
        const meager = wealth < (game.u?.ulevel ?? 1) * 1000 ? 'meager ' : '';
        await pline(`You coil up around your ${meager}hoard.`);
        return;
    }
    if (object.otyp === TOWEL) {
        await pline("It's probably not a good time for a picnic...");
        return;
    }
    const name = definiteName(objectCombatName(object, { includeCorpseSpecies: false }));
    await pline(monsterIsSlithy(heroMonsterForm(game) ?? -1)
        ? `You coil up around ${name}.`
        : `You sit on ${name}.`);
    if (object.otyp === CORPSE
        && monsterIsAmorphous({ mnum: object.corpsenm ?? -1 })) {
        await pline("It's squishy...");
    }
    else if (object.otyp === CREAM_PIE) {
        if (!heroIsDeaf())
            await pline('Squelch!');
        await useUpFloorObject(object, object.quan);
    }
    else if (object.otyp !== LARGE_BOX && object.otyp !== CHEST
        && objectMaterial(object.otyp) !== CLOTH) {
        await pline("It's not very comfortable...");
    }
}
// Part of C sit.c:dosit(): sitting while already held by a trap.
// Returns true when the hero died.
async function sitWhileTrapped(trap) {
    const game = requireInitializedGame();
    const u = game.u;
    if (u.utrap === undefined)
        throw new Error('Sitting while trapped requires an active trap duration.');
    await exerciseAttribute(A_WIS, false);
    if (u.utraptype === TT_BEARTRAP) {
        await pline(`You can't sit down with your ${body_part(FOOT)} in the bear trap.`);
        u.utrap++;
    }
    else if (u.utraptype === TT_PIT) {
        if (trap?.ttyp === SPIKED_PIT) {
            await pline('You sit down on a spike.  Ouch!');
            const damage = u.halfPhysicalDamage
                ? rn2(2) : 1;
            if (await loseHeroHp(damage, 'sitting on an iron spike', { deathCause: 'killed by sitting on an iron spike' }))
                return true;
            await exerciseAttribute(A_STR, false);
        }
        else {
            await pline('You sit down in the pit.');
        }
        u.utrap += rn2(5);
    }
    else if (u.utraptype === TT_WEB) {
        await pline('You sit in the spider web and get entangled further!');
        u.utrap += 5 + rn2(10);
    }
    else if (u.utraptype === TT_LAVA) {
        await pline(`You sit in the ${displayLiquidName('lava')}!`);
        await burnAwayHeroSlime(game, pline);
        u.utrap += rnd(4);
        if (await loseHeroHp(d(2, 10), 'sitting in lava', { deathCause: 'killed by sitting in lava' }))
            return true;
    }
    else if (u.utraptype === TT_INFLOOR
        || u.utraptype === TT_BURIEDBALL) {
        await pline("You can't maneuver to sit!");
        u.utrap++;
    }
    return false;
}
// Part of C sit.c:dosit(): water exposure while sitting.
async function sitInWater() {
    await pline(`You sit in the ${displayLiquidName('water')}.`);
    if (heroMonsterForm(game) === PM_GREMLIN) {
        await splitSittingGremlin();
        return;
    }
    const armor = game.uarm || game.u?.uarm;
    const boots = game.uarmf || game.u?.uarmf;
    if (rn2(10) === 0 && armor)
        await waterDamageObject(armor, [], game, { force: true, description: 'armor', publish: pline });
    if (rn2(10) === 0 && boots && boots.otyp !== WATER_WALKING_BOOTS) {
        // sit.c passes uarm here too; preserve that behavior from the pinned
        // source rather than silently changing which item gets wet.
        await waterDamageObject(armor, [], game, { force: true, description: 'armor', publish: pline });
    }
}
// Part of C sit.c:dosit(): recognize forms comfortable sitting in lava.
function formLikesLava() {
    const form = heroMonsterForm(game);
    return form === PM_FIRE_ELEMENTAL || form === PM_SALAMANDER;
}
// C sit.c:dosit()
export async function dosit({ finishTeleport = null, gotoLevel = null, chooseTeleportDestination = null, } = {}) {
    const game = requireInitializedGame();
    const u = game.u;
    const x = u?.ux;
    const y = u?.uy;
    const location = game.level.requireAt(x, y);
    const typ = location.typ;
    const trap = game.level?.traps?.find(candidate => candidate.tx === x && candidate.ty === y) || null;
    if (u?.usteed) {
        await pline(`You are already sitting on ${monsterName(u.usteed)}.`);
        game.context.move = 0;
        return;
    }
    if (u?.uundetected && heroFormHidesWithoutCover(game)
        && heroMonsterForm(game) !== PM_TRAPPER)
        u.uundetected = 0;
    if (!heroCanReachFloor(game)) {
        if (u?.uswallow)
            await pline('There are no seats in here!');
        else if (u?.levitating || game.levitating)
            await pline('You tumble in place.');
        else
            await pline('You are sitting on air.');
        game.context.move = 0;
        return;
    }
    if (u?.ustuck && !heroFormSticks(game)) {
        const holder = u.ustuck;
        const humanoid = monsterIsHumanoid(holder.mnum);
        const subject = monsterName(holder, { capitalized: true });
        await pline(humanoid
            ? `${subject} won't offer ${monsterPossessive(holder)} lap.`
            : `${subject} has no lap.`);
        game.context.move = 0;
        return;
    }
    const onPool = isPoolAt(x, y);
    if ((onPool && !(game.underwater || u?.uinwater))
        || (heroMonsterForm(game) === PM_GREMLIN
            && (typ === FOUNTAIN || onPool))) {
        await sitInWater();
        game.context.move = 1;
        return;
    }
    const object = game.level?.objects?.[x]?.[y]?.[0];
    const atPitEdge = trap?.tseen && (is_hole(trap.ttyp)
        || is_pit(trap.ttyp) && !(u.utrap && u.utraptype === TT_PIT));
    if (object && !atPitEdge) {
        await sitOnObject(object);
    }
    else if (trap || (u?.utrap && (u.utraptype ?? 0) >= TT_LAVA)) {
        if (u?.utrap) {
            if (await sitWhileTrapped(trap))
                return;
        }
        else {
            await pline(`You ${u?.flying || game.flying ? 'land' : 'sit down'}.`);
            const result = await dotrap(trap, {
                finishTeleport,
                gotoLevel,
                viaSitting: true,
            });
            if (result.died)
                return;
        }
    }
    else if ((game.underwater || u?.uinwater
        || Is_waterlevel(game.u.uz)) && !waterEggLayer()) {
        await pline(Is_waterlevel(game.u.uz)
            ? 'There are no cushions floating nearby.'
            : 'You sit down on the muddy bottom.');
    }
    else if (onPool && !waterEggLayer()) {
        await sitInWater();
    }
    else if (typ === SINK) {
        await pline('You sit on the sink.');
        await pline(`Your ${formIsHumanoid() ? 'rump' : 'underside'} gets wet.`);
    }
    else if (typ === ALTAR) {
        await pline('You sit on the altar.');
        await altarWrath(x, y);
    }
    else if (typ === GRAVE) {
        await pline('You sit on the grave.');
    }
    else if (typ === STAIRS) {
        await pline('You sit on the stairs.');
    }
    else if (typ === LADDER) {
        await pline('You sit on the ladder.');
    }
    else if (isLavaAt(x, y)) {
        await pline(`You sit on the ${displayLiquidName('lava')}.`);
        await burnAwayHeroSlime(game, pline);
        if (formLikesLava()) {
            await pline(`The ${displayLiquidName('lava')} feels warm.`);
        }
        else {
            await pline(`The ${displayLiquidName('lava')} burns you!`);
            const dice = u?.fireResistance ? 2 : 10;
            if (await loseHeroHp(d(dice, 10), 'sitting on lava', { deathCause: 'killed by sitting on lava' }))
                return;
        }
    }
    else if (isIceAt(x, y)) {
        await pline('You sit on the ice.');
        if (!u?.coldResistance)
            await pline('The ice feels cold.');
    }
    else if (typ === DRAWBRIDGE_DOWN) {
        await pline('You sit on the drawbridge.');
    }
    else if (typ === THRONE) {
        await pline('You sit on the opulent throne.');
        await throneSitEffect({ gotoLevel, chooseTeleportDestination });
    }
    else if (lays_eggs(heroMonsterForm(game) ?? -1)) {
        if (!await layEgg()) {
            game.context.move = 0;
            return;
        }
    }
    else {
        await pline(`Having fun sitting on the ${surfaceName(x, y)}?`);
    }
    game.context.move = 1;
}
// C sit.c:rndcurse()
// Also C artifact.c:spec_ability(): inlined here; selfWilled is the
// artifact's SPFX_INTEL flag, checked with rn2(10) < 8 before cursing.
export async function rndcurse({ publish = plineWithContinuation, } = {}) {
    const state = game;
    const hero = state.u;
    const weapon = state.uwep || hero.uwep;
    if (artifactById(weapon?.oartifact)?.name === 'Magicbane' && rn2(20)) {
        await publish('You feel a malignant aura surround the magic-absorbing blade.');
        return [];
    }
    const antimagic = !!hero.antimagic;
    const halfSpellDamage = heroHasHalfSpellDamage(state);
    if (antimagic)
        await shieldeff(hero.ux, hero.uy, state);
    await publish('You feel a malignant aura surround you.');
    const inventoryCount = (state.inventory || []).filter(object => object.oclass !== COIN_CLASS).length;
    const sides = Math.trunc(6
        / (Number(antimagic) + Number(halfSpellDamage) + 1));
    const count = rnd(sides);
    const changed = [];
    for (let remaining = count; inventoryCount && remaining > 0; remaining--) {
        // Native keeps the initial count but traverses the live inventory.
        // Cursing an active offhand can remove it between selections.
        const index = rnd(inventoryCount) - 1;
        const object = (state.inventory || []).filter(candidate => candidate.oclass !== COIN_CLASS)[index];
        if (!object || object.cursed)
            continue;
        if (artifactById(object.oartifact)?.selfWilled && rn2(10) < 8) {
            const name = definiteName(objectCombatName(object, { includeCorpseSpecies: false }));
            const subject = name.charAt(0).toUpperCase() + name.slice(1);
            await publish(`${subject} ${objectNameIsPlural(object) ? 'resist' : 'resists'}!`);
            continue;
        }
        if (object.blessed) {
            const oldRadius = objectLightRadius(object, state);
            unblessObjectState(object, state);
            await adjustObjectLightAfterBlessing(object, oldRadius, state);
        }
        else {
            await curseObject(object);
            await dropCursedSecondaryWeapon(object, state);
            if (state.program_state.gameover)
                return changed;
        }
        changed.push(object);
    }
    let saddle = null;
    if (hero.usteed && rn2(4) === 0)
        saddle = monsterSaddle(hero.usteed);
    if (saddle && !saddle.cursed) {
        if (saddle.blessed)
            unblessObjectState(saddle);
        else
            await curseObject(saddle);
        if (heroIsBlind(state)) {
            saddle.bknown = false;
        }
        else {
            const subject = ownedObjectAction(saddle, 'glow', state);
            const color = displayColorName(saddle.cursed ? 'black' : 'brown', state);
            await publish(`${subject} ${color}.`);
            saddle.bknown = !(heroIsHallucinating(state));
        }
        changed.push(saddle);
    }
    return changed;
}
// C sit.c:attrcurse()
// Selection falls through the source list until it finds an intrinsic the
// hero actually has. Worn sources stay active.
export async function attrcurse({ publish = plineWithContinuation } = {}) {
    const hero = game.u;
    const start = rnd(CURSEABLE_INTRINSICS.length) - 1;
    for (const [property, sensation] of CURSEABLE_INTRINSICS.slice(start)) {
        if (!hasPermanentIntrinsicProperty(property, game))
            continue;
        removePermanentIntrinsicProperty(property, game);
        if (property === 'telepathy' && heroIsBlind(game)
            && !hero.telepathy)
            await see_monsters();
        if (property === 'invisible')
            syncHeroInvisibility(game);
        if (property === 'seeInvisible') {
            if (!hero.seeInvisible) {
                await refreshHeroSeeing();
            }
            await publish(heroIsHallucinating(game)
                ? 'You tawt you taw a puttie tat!'
                : 'You thought you saw something!');
        }
        else if (property === 'telepathy') {
            await publish('Your senses fail!');
        }
        else if (sensation) {
            await publish(formatFeltMessage(sensation));
        }
        return property;
    }
    return null;
}
//# sourceMappingURL=sit.js.map