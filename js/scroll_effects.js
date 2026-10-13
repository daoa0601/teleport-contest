// C read.c:seffects(). Scrolls and scroll-like spells use the same effects;
// the caller owns normal discovery, source disposal, and the action turn.
import { exerciseAttribute } from './attrib.js';
import { heroIsPunished } from './ball.js';
import { heroHandName, heroHeadName, heroLegName } from './body_parts.js';
import { A_WIS, COLNO, ROWNO, SDOOR, TT_BURIEDBALL, W_ART, W_ARTI, W_BALL, isok } from './const.js';
import { canSpotMonster, displayColorName, pline, plineWithContinuation } from './display.js';
import { revealSecretDoor } from './detect.js';
import { impossible } from './diagnostics.js';
import { doClassGenocide, doGenocide } from './genocide.js';
import { applyLightScrollEffect } from './light.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import { heroIsInvisible } from './hero_invisibility.js';
import { makeConfused } from './hero_mental_status.js';
import { heroSpecies } from './hero_species.js';
import { formatHeardMessage } from './hero_speech.js';
import { freeHeroFromBuriedBall } from './hero_traps.js';
import { consumeInventoryItem, identifyPack } from './invent.js';
import { detectFood, detectGold, mapMagicLevel } from './magic_detection.js';
import { createCritters } from './mklev.js';
import { angerMonster } from './monster_anger.js';
import { MONSTER_NAME, MONSTER_SYMBOL } from './monster_data.js';
import { makeMonsterFlee } from './monster_flee.js';
import { monsterAtPosition } from './monster_location.js';
import { monsterResistsEffect } from './monster_resistance.js';
import { tameMonster } from './monster_taming.js';
import { makePlural } from './object_grammar.js';
import { LEASH, LOADSTONE, OBJECT_INITIAL_KNOWN, OBJECT_MAGIC, OBJECT_MERGE, OBJECT_NAMES, POT_WATER, SCR_AMNESIA, SCR_BLANK_PAPER, SCR_CREATE_MONSTER, SCR_DESTROY_ARMOR, SCR_EARTH, SCR_ENCHANT_ARMOR, SCR_ENCHANT_WEAPON, SCR_FIRE, SCR_GENOCIDE, SCR_IDENTIFY, SCR_LIGHT, SCR_MAGIC_MAPPING, SCR_PUNISHMENT, SCR_REMOVE_CURSE, SCR_SCARE_MONSTER, SCR_STINKING_CLOUD, SCR_TELEPORTATION, SLING, SPE_CAUSE_FEAR, SPE_CHARM_MONSTER, SPE_CONFUSE_MONSTER, SPE_CREATE_MONSTER, SPE_DETECT_FOOD, SPE_IDENTIFY, SPE_MAGIC_MAPPING, SPE_REMOVE_CURSE, } from './object_data.js';
import { blessObjectState, curseObject, uncurseObjectState } from './object_state.js';
import { ownedObjectAction } from './objnam.js';
import { punishHero, unpunishHero } from './punishment.js';
import { chooseObjectToCharge, rechargeObject } from './recharge.js';
import { applyArmorScrollEffect } from './scroll_armor_effects.js';
import { applyAreaScrollEffect } from './scroll_area_effects.js';
import { learnScrollType, learnScroll } from './scroll_discovery.js';
import { finishStrangeFeeling } from './scroll_strange_feeling.js';
import { teleportScrollEffect } from './scroll_teleport.js';
import { detectTraps } from './trap_detection.js';
import { d, rn2, rn1, rnd } from './rng.js';
import { heroIsBlind, heroIsHallucinating } from './senses.js';
import { chargeAlteredUnpaidObject, updateUnpaidObjectPrice } from './shk.js';
import { monsterSaddle } from './steed.js';
import { dropCursedSecondaryWeapon } from './two_weapon.js';
import { cansee } from './vision.js';
const WEAPON_CLASS = 2;
const SCROLL_CLASS = 9;
const SPBOOK_CLASS = 10;
const COIN_CLASS = 12;
const GEM_CLASS = 13;
const S_HUMAN = 53;
const SCR_CONFUSE_MONSTER = OBJECT_NAMES.indexOf('confuse monster');
const SCR_TAMING = OBJECT_NAMES.indexOf('taming');
const SCR_GOLD_DETECTION = OBJECT_NAMES.indexOf('gold detection');
const SCR_FOOD_DETECTION = OBJECT_NAMES.indexOf('food detection');
const SCR_CHARGING = OBJECT_NAMES.indexOf('charging');
const SCR_MAIL = OBJECT_NAMES.indexOf('mail');
export async function applyScrollEffects(source, { state = game, gotoLevel, finishHeroDeath, finishMonsterKill, } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const hooks = { gotoLevel, finishHeroDeath, finishMonsterKill };
    await exerciseScrollWisdom(source.otyp, state);
    const result = await scrollEffect(source, state, hooks);
    return {
        known: !!result?.known,
        consumed: !!result?.consumed,
        heroDied: !!result?.heroDied || !!state.program_state.gameover,
    };
}
// C sit.c uses a zeroobj spell source on the stack. It has no inventory
// identity or creation effects, but still passes through seffects' Wisdom gain.
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
async function exerciseScrollWisdom(otyp, state) {
    if (OBJECT_MAGIC[otyp])
        await exerciseAttribute(A_WIS, true, state);
}
async function scrollEffect(source, state, hooks) {
    switch (source.otyp) {
        case SCR_ENCHANT_ARMOR:
        case SCR_DESTROY_ARMOR:
        case SCR_ENCHANT_WEAPON:
            return applyArmorScrollEffect(source, { state });
        case SCR_AMNESIA:
        case SCR_FIRE:
        case SCR_EARTH:
        case SCR_STINKING_CLOUD:
            return applyAreaScrollEffect(source, {
                state,
                finishHeroDeath: hooks.finishHeroDeath,
                finishMonsterKill: hooks.finishMonsterKill,
            });
        case SCR_REMOVE_CURSE:
        case SPE_REMOVE_CURSE:
            await removeCurseEffect({ source, state, publish: plineWithContinuation });
            return;
        case SCR_CONFUSE_MONSTER:
        case SPE_CONFUSE_MONSTER:
            await confuseMonsterEffect(source, state);
            return;
        case SCR_GOLD_DETECTION:
        case SCR_FOOD_DETECTION:
        case SPE_DETECT_FOOD:
            return detectionEffect(source, state);
        case SCR_SCARE_MONSTER:
        case SPE_CAUSE_FEAR:
            return causeFearEffect(source, state);
        case SCR_IDENTIFY:
        case SPE_IDENTIFY:
            await identifyEffect(source, { state });
            return { consumed: source.oclass === SCROLL_CLASS };
        case SCR_TAMING:
        case SPE_CHARM_MONSTER:
            return charmMonsterEffect(source, state);
        case SCR_MAGIC_MAPPING:
        case SPE_MAGIC_MAPPING:
            return magicMappingEffect(source, state);
        case SCR_CREATE_MONSTER:
        case SPE_CREATE_MONSTER: {
            const confused = (state.u.confusionTurns ?? 0) > 0;
            const count = 1 + (confused || source.cursed ? 12 : 0)
                + (source.blessed || rn2(73) ? 0 : rnd(4));
            const known = await createCritters(count, confused ? MONSTER_NAME.indexOf('acid blob') : null);
            return { known };
        }
        case SCR_LIGHT:
            return applyLightScrollEffect(source, hooks.finishMonsterKill
                ? { finishMonsterKill: hooks.finishMonsterKill } : {});
        case SCR_GENOCIDE:
            if (source.oclass !== SPBOOK_CLASS && !OBJECT_INITIAL_KNOWN[source.otyp]
                && !state._knownObjectTypes?.has(source.otyp))
                await plineWithContinuation('You have found a scroll of genocide!');
            if (source.blessed)
                await doClassGenocide(hooks.finishHeroDeath
                    ? { finishHeroDeath: hooks.finishHeroDeath } : {});
            else
                await doGenocide(Number(!source.cursed)
                    | (2 * Number((state.u.confusionTurns ?? 0) > 0)), hooks.finishHeroDeath
                    ? { finishHeroDeath: hooks.finishHeroDeath } : {});
            return { known: true };
        case SCR_CHARGING:
            return chargingEffect(source, state);
        case SCR_TELEPORTATION:
            return teleportScrollEffect(source, { state, gotoLevel: hooks.gotoLevel });
        case SCR_PUNISHMENT:
            if (source.blessed || (state.u.confusionTurns ?? 0) > 0)
                await plineWithContinuation('You feel guilty.');
            else
                await punishHero(source);
            return { known: true };
        case SCR_BLANK_PAPER:
            await plineWithContinuation(heroIsBlind(state)
                ? "You don't remember there being any magic words on this scroll."
                : 'This scroll seems to be blank.');
            return { known: true };
        case SCR_MAIL:
            await mailEffect(source, state);
            return { known: true };
        default:
            await impossible(`What weird effect is this? (${source.otyp})`);
            return;
    }
}
async function detectionEffect(source, state) {
    const detect = source.otyp === SCR_GOLD_DETECTION
        ? (source.cursed || (state.u.confusionTurns ?? 0) > 0 ? detectTraps : detectGold)
        : detectFood;
    const result = await detect(source, { state });
    if (result.strangeFeeling)
        await finishStrangeFeeling(source, { state });
    return { known: !!result.known, consumed: !!result.result };
}
async function chargingEffect(source, state) {
    const blessing = source.cursed ? -1 : source.blessed ? 1 : 0;
    if ((state.u.confusionTurns ?? 0) > 0) {
        await plineWithContinuation(source.cursed ? 'You feel discharged.' : 'You feel charged up!');
        if (source.cursed)
            state.u.uen = 0;
        else {
            state.u.uen += d(source.blessed ? 6 : 4, 4);
            state.u.uen = state.u.uenmax = Math.max(state.u.uen, state.u.uenmax);
        }
        state.context.botl = true;
        return;
    }
    const known = source.oclass === SPBOOK_CLASS || OBJECT_INITIAL_KNOWN[source.otyp]
        || state._knownObjectTypes?.has(source.otyp);
    if (!known) {
        await plineWithContinuation('This is a charging scroll.');
        learnScroll(source, { state });
    }
    await consumeInventoryItem(source, state);
    const object = await chooseObjectToCharge(state);
    const charged = object ? await rechargeObject(object, blessing, state) : null;
    return { consumed: true, heroDied: !!charged?.heroDied };
}
async function mailEffect(source, state) {
    const odd = (source.o_id ?? 0) % 2 === 1;
    if (source.spe === 2)
        await plineWithContinuation(`This scroll is marked "${odd ? 'Postage Due' : 'Return to Sender'}".`);
    else if (source.spe === 1)
        await plineWithContinuation(`This seems to be ${odd
            ? 'a chain letter threatening your luck' : 'junk mail addressed to the finder of the Eye of Larn'}.`);
    else if (!state.iflags?.debug_fuzzer)
        await plineWithContinuation('This game cannot open the system mail reader.');
}
async function confuseMonsterEffect(source, state) {
    const hero = state.u;
    const confused = (hero.confusionTurns ?? 0) > 0;
    const hiddenHands = heroIsBlind(state) || (heroIsInvisible(state)
        && !(hero.seeInvisible || (hero.seeInvisibleTurns ?? 0) > 0));
    const hands = makePlural(heroHandName(state));
    if (MONSTER_SYMBOL[heroSpecies(state)] !== S_HUMAN || source.cursed) {
        if (!hero.confusionTurns)
            await plineWithContinuation('You feel confused.');
        await makeConfused((hero.confusionTurns ?? 0) + rnd(100), { state, talk: false });
        return;
    }
    if (confused) {
        if (!source.blessed) {
            const feeling = hiddenHands ? 'tingle' : `glow ${displayColorName('purple', state)}`;
            await plineWithContinuation(`Your ${hands} begin to ${feeling}.`);
            await makeConfused((hero.confusionTurns ?? 0) + rnd(100), { state, talk: false });
        }
        else {
            const aura = hiddenHands ? 'faint buzz' : `${displayColorName('red', state)} glow`;
            await plineWithContinuation(`A ${aura} surrounds your ${heroHeadName(state)}.`);
            await makeConfused(0, { state });
        }
        return;
    }
    let increase = source.oclass === SCROLL_CLASS ? 3 : 0;
    if (!source.blessed) {
        if (hiddenHands) {
            await plineWithContinuation(`Your ${hands} tingle${hero.umconf ? ' even more' : ''}.`);
        }
        else if (!hero.umconf) {
            await plineWithContinuation(`Your ${hands} begin to glow ${displayColorName('red', state)}.`);
        }
        else {
            await plineWithContinuation(`The ${displayColorName('red', state)} glow of your ${hands} intensifies.`);
        }
        increase += rnd(2);
    }
    else {
        if (hiddenHands) {
            await plineWithContinuation(`Your ${hands} tingle ${hero.umconf ? 'even more' : 'very'} sharply.`);
        }
        else {
            await plineWithContinuation(`Your ${hands} glow ${hero.umconf ? 'an even more' : 'a'} brilliant ${displayColorName('red', state)}.`);
        }
        increase += rn1(8, 2);
    }
    hero.umconf = (hero.umconf ?? 0) + ((hero.umconf ?? 0) >= 40 ? 1 : increase);
}
async function causeFearEffect(source, state) {
    const reverse = source.cursed || (state.u.confusionTurns ?? 0) > 0;
    let nonPets = 0;
    for (const monster of [...state.level.monsters].reverse()) {
        if (monster.dead || monster.mhp <= 0 || !cansee(monster.mx, monster.my))
            continue;
        if (reverse) {
            monster.mflee = monster.mfrozen = monster.msleeping = 0;
            monster.mcanmove = 1;
        }
        else if (!monsterResistsEffect(monster, source.oclass === SCROLL_CLASS ? 9 : state.u.ulevel)) {
            const result = await makeMonsterFlee(monster, { state, announce: false });
            if (result.heroDied)
                return { heroDied: true };
        }
        if (!monster.mtame)
            nonPets++;
    }
    if (source.otyp === SCR_SCARE_MONSTER || !nonPets) {
        const message = formatHeardMessage(`${reverse ? 'sad wailing' : 'maniacal laughter'} ${nonPets ? 'close by' : 'in the distance'}.`, state);
        if (message)
            await plineWithContinuation(message);
    }
    return;
}
async function maybeTame(monster, source, state) {
    const wasTame = monster.mtame ?? 0;
    const wasPeaceful = !!monster.mpeaceful;
    if (source.cursed) {
        await angerMonster(monster);
        return wasPeaceful && !monster.mpeaceful ? -1 : 0;
    }
    if (!monsterResistsEffect(monster, source.oclass === SCROLL_CLASS ? 9 : state.u.ulevel) || monster.isshk)
        await tameMonster(monster, source, { state });
    return (!wasPeaceful && monster.mpeaceful) || wasTame !== (monster.mtame ?? 0) ? 1 : 0;
}
async function charmMonsterEffect(source, state) {
    let candidates = 0, results = 0, visibleResults = 0;
    if (state.u.uswallow) {
        const swallower = state.u.ustuck;
        if (!swallower)
            throw new Error('A swallowed hero needs its swallowing monster.');
        candidates = 1;
        results = visibleResults = await maybeTame(swallower, source, state);
        if (state.program_state.gameover)
            return { heroDied: true };
    }
    else {
        const radius = (state.u.confusionTurns ?? 0) > 0 ? 5 : 1;
        for (let dx = -radius; dx <= radius; dx++) {
            for (let dy = -radius; dy <= radius; dy++) {
                const x = state.u.ux + dx, y = state.u.uy + dy;
                if (!isok(x, y))
                    continue;
                const monster = monsterAtPosition(state.level, x, y)
                    || (!dx && !dy ? state.u.usteed : null);
                if (!monster)
                    continue;
                candidates++;
                const changed = await maybeTame(monster, source, state);
                if (state.program_state.gameover)
                    return { heroDied: true };
                results += changed;
                if (canSpotMonster(monster))
                    visibleResults += changed;
            }
        }
    }
    await plineWithContinuation(!results
        ? `Nothing interesting ${candidates ? 'seems to happen' : 'happens'}.`
        : `The neighborhood ${visibleResults ? 'is' : 'seems'} ${results < 0 ? 'un' : ''}friendlier.`);
    return { known: visibleResults > 0 };
}
async function magicMappingEffect(source, state) {
    const isScroll = source.oclass === SCROLL_CLASS;
    if (state.level.flags.nommap) {
        if (isScroll) {
            await plineWithContinuation('Your mind is filled with crazy lines!');
            await plineWithContinuation(heroIsHallucinating(state)
                ? 'Wow!  Modern art.' : `Your ${heroHeadName(state)} spins in bewilderment.`);
        }
        else {
            await plineWithContinuation(`Your ${heroHeadName(state)} spins as something blocks the spell!`);
        }
        await makeConfused((state.u.confusionTurns ?? 0) + rnd(30), { state, talk: false });
        return;
    }
    if (isScroll && source.blessed) {
        for (let x = 1; x < COLNO; x++) {
            for (let y = 0; y < ROWNO; y++) {
                if (state.level.requireAt(x, y).typ === SDOOR)
                    revealSecretDoor(x, y);
            }
        }
    }
    await plineWithContinuation('A map coalesces in your mind!');
    const temporarilyConfused = source.cursed && !((state.u.confusionTurns ?? 0) > 0);
    if (temporarilyConfused)
        state.u.confusionTurns = 1;
    await mapMagicLevel({ state });
    if (temporarilyConfused) {
        state.u.confusionTurns = 0;
        await plineWithContinuation("Unfortunately, you can't grasp the details.");
    }
    return { known: isScroll };
}
// Native seffect_identify(), including the scroll-only consumption and
// discovery boundary before selecting the remaining inventory.
export async function identifyEffect(source, { state = game, } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const isScroll = source.oclass === SCROLL_CLASS;
    const alreadyKnown = !isScroll || state._knownObjectTypes?.has(source.otyp);
    if (isScroll) {
        const selfOnly = (state.u.confusionTurns ?? 0) > 0 || (source.cursed && !alreadyKnown);
        await consumeInventoryItem(source);
        if (selfOnly)
            await plineWithContinuation('You identify this as an identify scroll.');
        else if (!alreadyKnown)
            await plineWithContinuation('This is an identify scroll.');
        if (!alreadyKnown)
            learnScrollType(SCR_IDENTIFY, { state });
        if (selfOnly)
            return [];
    }
    if (!state.inventory.length) {
        await plineWithContinuation(`You're not carrying anything${isScroll ? ' else' : ''} to be identified.`);
        return [];
    }
    let limit = 1;
    if (source.blessed || (!source.cursed && !rn2(5))) {
        limit = rn2(5);
        if (limit === 1 && source.blessed && (state.u.uluck ?? 0) > 0)
            limit++;
    }
    return identifyPack(limit, !alreadyKnown);
}
function removeCurseWornMask(object, state) {
    let mask = (object.owornmask ?? 0) & ~(W_BALL | W_ART | W_ARTI);
    const swapWeapon = state.uswapwep || state.u?.uswapwep;
    const quiver = state.uquiver || state.u?.uquiver;
    if (object === swapWeapon && !(state.u?.twoweap)) {
        mask = 0;
    }
    else if (object === quiver) {
        if (object.oclass === WEAPON_CLASS) {
            if (!OBJECT_MERGE[object.otyp])
                mask = 0;
        }
        else if (object.oclass === GEM_CLASS) {
            if ((state.uwep || state.u?.uwep)?.otyp !== SLING)
                mask = 0;
        }
        else {
            mask = 0;
        }
    }
    return mask;
}
function removeCurseAppliesTo(object, blessed, state) {
    return blessed || !!removeCurseWornMask(object, state)
        || object.otyp === LOADSTONE
        || (object.otyp === LEASH && !!object.leashmon);
}
async function randomlyBlessOrCurse(object, state) {
    if (object.blessed || object.cursed || rn2(2))
        return false;
    if (rn2(2))
        return blessObjectState(object);
    const changed = await curseObject(object, { state });
    await dropCursedSecondaryWeapon(object, state);
    return changed;
}
export function removeCurseFeeling(confused) {
    const hallucinating = heroIsHallucinating(game);
    if (hallucinating) {
        return confused
            ? 'the power of the Force against you!'
            : 'in touch with the Universal Oneness.';
    }
    return confused ? 'like you need some help.'
        : 'like someone is helping you.';
}
// C read.c:seffect_remove_curse().  The caller owns scroll consumption and
// its reading message; this function owns the effect on carried equipment.
export async function removeCurseEffect({ source = null, state = game, blessed = !!source?.blessed, cursed = !!source?.cursed, confused = (state.u.confusionTurns ?? 0) > 0, publish = pline, announce = true, } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    if (announce)
        await publish(`You feel ${removeCurseFeeling(confused)}`);
    if (cursed && announce)
        await publish('The scroll disintegrates.');
    const changed = [];
    for (const object of cursed ? [] : [...(state.inventory || [])]) {
        const quantity = object.quan ?? object.quantity ?? 1;
        if (object.oclass === COIN_CLASS
            || (object === source && quantity === 1)
            || !removeCurseAppliesTo(object, blessed, state))
            continue;
        if (confused) {
            if (await randomlyBlessOrCurse(object, state))
                changed.push(object);
            if (state.program_state.gameover)
                return changed;
            object.bknown = false;
            if (object.unpaid && object.otyp === POT_WATER
                && (object.blessed || object.cursed))
                updateUnpaidObjectPrice(object, state);
        }
        else if (object.cursed) {
            if (object.unpaid && object.otyp === POT_WATER)
                await chargeAlteredUnpaidObject(object, 'uncurse', state);
            uncurseObjectState(object);
            if (object.bknown && source?.otyp === SCR_REMOVE_CURSE
                && !state._knownObjectTypes?.has(SCR_REMOVE_CURSE)) {
                learnScrollType(SCR_REMOVE_CURSE, { state });
            }
            changed.push(object);
        }
    }
    const saddle = cursed ? null : monsterSaddle(state.u.usteed);
    if (saddle && confused) {
        if (await randomlyBlessOrCurse(saddle, state))
            changed.push(saddle);
        saddle.bknown = false;
    }
    else if (saddle?.cursed) {
        uncurseObjectState(saddle);
        changed.push(saddle);
        if (!heroIsBlind(state)) {
            await publish(`${ownedObjectAction(saddle, 'glow', state)} ${displayColorName('amber', state)}.`);
            saddle.bknown = !(heroIsHallucinating(state));
        }
        else {
            saddle.bknown = false;
        }
    }
    if (heroIsPunished(state) && !confused)
        await unpunishHero(state);
    if (state.u.utrap && state.u.utraptype === TT_BURIEDBALL) {
        await freeHeroFromBuriedBall(state);
        await publish(`The clasp on your ${heroLegName(state)} vanishes.`);
    }
    return changed;
}
//# sourceMappingURL=scroll_effects.js.map