// Prayer decisions and the three-turn prayer occupation.
// C pray.c:can_pray(), dopray(), prayer_done(), and pleased().

import { formatFeltMessage } from './hero_speech.js';
import { endVoluntaryMultiTurn } from './command_state.js';
import { game, requireInitializedGame, requirePlayingGame } from './gstate.js';
import { displayColorName, flushPendingTopline, plineWithContinuation as pline } from './display.js';
import { recordGameLogEvent } from './gamelog.js';
import { paranoidQuery, promptYesNo } from './query.js';
import { rn1, rn2, rnl, rnd, rnz } from './rng.js';
import { adjustHeroAlignment, deityName } from './alignment.js';
import { angryGods, godsUpset, godVoice } from './divine_wrath.js';
import { grantPrayerFavor } from './divine_gifts.js';
import {
    A_CON, A_NONE, A_WIS, ALTAR, AM_SHRINE, Amask2align, LUCKMIN,
    PARANOID_CONFIRM, PARANOID_PRAY,
} from './const.js';
import { adjustAttribute, attributeChangeMessage, exerciseAttribute } from './attrib.js';
import { reviveCorpseForHero } from './corpse_revival.js';
import { loseHeroHp } from './hero_damage.js';
import { MONSTER_FLAGS2, requireMonsterData } from './monster_data.js';
import { wakeMonstersNearWithMessages } from './monster_wake.js';
import { CORPSE, OBJECT_NAMES, STATUE } from './object_data.js';
import { blessObjectState, curseObject } from './object_state.js';
import { returnHeroToHumanForm } from './polyself.js';
import { fixPrayerTrouble, worstPrayerTrouble } from './prayer_trouble.js';
import { heroIsBlind, heroIsDeaf, heroIsHallucinating } from './senses.js';
import { animateStatue } from './statue_trap.js';
import type { GameState, PrayerOutcome } from './game_state.js';
import type { PrayerTrouble } from './prayer_trouble.js';

const POT_WATER = OBJECT_NAMES.indexOf('water');
const M2_DEMON = 0x00000100;
const M2_UNDEAD = 0x00000002;

const STRIDENT = 4;
export async function altarWrath(x: number, y: number, state: GameState = game) {
    requirePlayingGame(state);
    const altarAlignment = Amask2align(state.level?.at(x, y)?.flags ?? 0);
    const heroAlignment = state.u?.ualign?.type ?? 0;
    const alignmentRecord = state.u?.ualign?.record ?? 0;
    const deity = deityName(altarAlignment, state);

    if (heroAlignment === altarAlignment && alignmentRecord > -rn2(4)) {
        await godVoice(altarAlignment, 'How darest thou desecrate my altar!', state);
        const change = adjustAttribute(A_WIS, -1, state);
        const message = attributeChangeMessage(A_WIS, change, state);
        if (message) await pline(message);
        state.u.ualign.record = alignmentRecord - 1;
        return;
    }

    await pline(heroIsDeaf(state)
        ? `Despite your deafness, you seem to hear ${deity} say:`
        : `A voice (could it be ${deity}?) whispers:`);
    await pline('"Thou shalt pay, infidel!"');
    const baseLuck = state.u.uluck ?? 0;
    const luck = baseLuck + (state.u.moreluck ?? 0);
    if (luck > -5 && rn2(luck + 6))
        state.u.uluck = Math.max(LUCKMIN, baseLuck - (rn2(20) ? 1 : 2));
}


export async function dopray() {
    const game = requireInitializedGame();
    game.context.move = 0;
    const bits = game.flags.paranoia_bits ?? PARANOID_PRAY;
    if (bits & PARANOID_PRAY) {
        const confirmed = await paranoidQuery(
            !!(bits & PARANOID_CONFIRM), 'Are you sure you want to pray?', bits,
        );
        if (!confirmed) return;
    }
    const hero = game.u;
    const conduct = hero.uconduct;
    if (!conduct.gnostic) recordGameLogEvent('rejected atheism with a prayer');
    conduct.gnostic = (conduct.gnostic || 0) + 1;
    const altar = currentAltar();
    const alignment = altar ? Amask2align(altar.flags) : hero.ualign.type;
    const trouble = worstPrayerTrouble();
    // The pinned can_pray() rejects a demon unless the deity is neutral,
    // despite its comment describing the opposite restriction.
    if (demonRejectsPrayer(alignment)) {
        await pline(`The very idea of praying to a ${alignment ? 'lawful' : 'neutral'} god is repugnant to you.`);
        return;
    }
    await pline(`You begin praying to ${deityName(alignment)}.`);
    let outcome = prayerOutcome(alignment, trouble);
    if (game.flags.debug && !['moloch', 'undead'].includes(outcome)) {
        await flushPendingTopline();
        if (await promptYesNo('Force the gods to be pleased?', 'n', !((game.flags.paranoia_bits ?? 0) & PARANOID_PRAY)) === 'y') {
            hero.ublesscnt = 0;
            hero.uluck = Math.max(0, hero.uluck || 0);
            hero.ualign.record = Math.max(1, hero.ualign.record);
            hero.ugangr = 0;
            if (outcome === 'too-soon' || outcome === 'angry') outcome = 'pleased';
        }
    }
    game._prayerAlignment = alignment;
    game._prayerTrouble = trouble;
    game._prayerOutcome = outcome;
    endVoluntaryMultiTurn(game);
    game._helplessTurns = Math.max(3, game._helplessTurns ?? 0, -game.multi);
    game.multi = -game._helplessTurns;
    game._helplessReason = 'praying';
    game._helplessDoneMessage = 'You finish your prayer.';
    game._helplessAfter = 'finish-prayer';
    if (outcome === 'pleased' && !inHell()) {
        if (!heroIsBlind(game)) await pline('You are surrounded by a shimmering light.');
        hero.invulnerable = true;
    }
    game.context.move = 1;
}

// C can_pray(FALSE) uses the same trouble, timeout, and deity decision as #pray.
export function canPraySafely(): boolean {
    const game = requireInitializedGame();
    const altar = currentAltar();
    const alignment = altar ? Amask2align(altar.flags) : game.u.ualign.type;
    const trouble = worstPrayerTrouble();
    if (demonRejectsPrayer(alignment)) return false;
    return prayerOutcome(alignment, trouble) === 'pleased' && !inHell();
}

function demonRejectsPrayer(alignment: number): boolean {
    const game = requireInitializedGame();
    return !!(requireMonsterData(MONSTER_FLAGS2, game.u.umonnum) & M2_DEMON) && alignment !== 0;
}

function prayerOutcome(alignment: number, trouble: PrayerTrouble): PrayerOutcome {
    const game = requireInitializedGame();
    const hero = game.u;
    let record = hero.ualign.record;
    if (hero.ualign.type && hero.ualign.type === -alignment) record = -record;
    else if (hero.ualign.type !== alignment) record = Math.trunc(record / 2);
    let outcome: PrayerOutcome;
    if (alignment === A_NONE) outcome = 'moloch';
    else if ((hero.ublesscnt || 0) > (trouble > 0 ? 200 : trouble < 0 ? 100 : 0))
        outcome = 'too-soon';
    else if (luck() < 0 || hero.ugangr || record < 0) outcome = 'angry';
    else outcome = currentAltar() && hero.ualign.type !== alignment ? 'other-god' : 'pleased';
    if (requireMonsterData(MONSTER_FLAGS2, hero.umonnum) & M2_UNDEAD && !inHell()
        && (alignment === 1 || alignment === 0 && !rn2(10))) outcome = 'undead';
    return outcome;
}

export async function finishPrayerOccupation(state: GameState = game) {
    requirePlayingGame(state);
    const alignment = state._prayerAlignment;
    const outcome = state._prayerOutcome;
    if (alignment === undefined || outcome === undefined)
        throw new Error('Prayer completion requires its retained alignment and outcome');
    state.u.invulnerable = false;
    try {
        if (outcome === 'moloch') {
            await pline(`You ${heroIsDeaf(state) ? 'intuit' : 'hear'} diabolical laughter all around you...`);
            await wakeMonstersNearWithMessages(state.u.ux, state.u.uy, state.u.ulevel * 20, state);
            adjustHeroAlignment(-2, state);
            await exerciseAttribute(A_WIS, false, state);
            if (!inHell()) {
                await pline('Nothing else happens.');
                return { outcome };
            }
        } else if (outcome === 'undead') {
            await godVoice(alignment, alignment === 1
                ? 'Vile creature, thou durst call upon me?' : 'Walk no more, perversion of nature!');
            await pline(formatFeltMessage('like you are falling apart.', state));
            await returnHeroToHumanForm(state);
            if (!state.program_state.gameover)
                await loseHeroHp(rnd(20), 'residual undead turning effect', { state });
            await exerciseAttribute(A_CON, false, state);
            return { outcome };
        }
        if (inHell()) {
            await pline(`Since you are in Gehennom, ${deityName(alignment)} can't help you.`);
            if (state.u.ualign.record <= 0 || rnl(state.u.ualign.record))
                await angryGods(state.u.ualign.type, state);
            return { outcome: 'hell' };
        }
        if (outcome === 'too-soon' || outcome === 'angry') {
            if (currentAltar() && state.u.ualign.type !== alignment) await changeAltarWater(false);
            if (outcome === 'too-soon') await punishEarlyPrayer();
            else await angryGods(state.u.ualign.type, state);
        } else if (outcome === 'other-god') {
            if (await changeAltarWater(false)) await punishEarlyPrayer();
            else await pleaseGod(alignment);
        } else {
            if (currentAltar()) {
                await reviveAltarPet();
                await changeAltarWater(true);
            }
            await pleaseGod(alignment);
        }
        return { outcome };
    } finally {
        delete state._prayerOutcome;
        delete state._prayerAlignment;
        delete state._prayerTrouble;
    }
}

async function punishEarlyPrayer() {
    const game = requireInitializedGame();
    game.u.ublesscnt = (game.u.ublesscnt || 0) + rnz(250);
    game.u.uluck = Math.max(LUCKMIN, (game.u.uluck || 0) - 3);
    await godsUpset(game.u.ualign.type);
}

async function pleaseGod(alignment: number) {
    const game = requireInitializedGame();
    const hero = game.u;
    let trouble = worstPrayerTrouble();
    const hallucinating = heroIsHallucinating(game);
    const mood = hero.ualign.record >= 14 ? (hallucinating ? 'pleased as punch' : 'well-pleased')
        : hero.ualign.record >= STRIDENT ? (hallucinating ? 'ticklish' : 'pleased')
            : hallucinating ? 'full' : 'satisfied';
    await pline(formatFeltMessage(`that ${deityName(alignment)} is ${mood}.`));
    if (currentAltar() && game._prayerAlignment !== hero.ualign.type) {
        adjustHeroAlignment(-1);
        return;
    }
    if (hero.ualign.record < 2 && trouble <= 0) adjustHeroAlignment(1);
    let favor = !trouble && hero.ualign.record >= 14 && game._prayerTrouble === 0;
    if (trouble || hero.ualign.record < 14) {
        const altar = currentAltar();
        let action = rn1(Math.max(luck(), -1) + (altar ? 3 + Number(!!(altar.flags & AM_SHRINE)) : 2), 1);
        if (!altar) action = Math.min(action, 3);
        if (hero.ualign.record < STRIDENT) action = hero.ualign.record > 0 || !rnl(2) ? 1 : 0;
        action = Math.min(action, 5);
        if (action >= 4) {
            favor = action === 5;
            do {
                await fixPrayerTrouble(trouble);
                if (game.program_state.gameover) return;
                trouble = worstPrayerTrouble();
            } while (trouble);
        } else if (action >= 2) {
            if (action === 3) await fixPrayerTrouble(trouble);
            let count = 0;
            while ((trouble = worstPrayerTrouble()) > 0 && ++count < 10) {
                await fixPrayerTrouble(trouble);
                if (game.program_state.gameover) return;
            }
        } else if (action === 1 && trouble > 0) {
            await fixPrayerTrouble(trouble);
        }
    }
    if (game.program_state.gameover) return;
    if (favor) await grantPrayerFavor(rn2((luck() + 6) >> 1), alignment);
    hero.ublesscnt = rnz(350);
    const extra = Number(!!hero.uevent?.udemigod) + Number(!!hero.uevent?.uhand_of_elbereth);
    if (extra) hero.ublesscnt += extra * rnz(1000);
    if (game.moves > 100000)
        hero.ublesscnt += Math.min(Math.trunc((game.moves - 100000) / 100), 32767 - hero.ublesscnt);
}

async function changeAltarWater(bless: boolean) {
    const game = requireInitializedGame();
    const hero = game.u;
    let changed = 0;
    let other = false;
    const known = !heroIsBlind(game) && !heroIsHallucinating(game);
    for (const object of game.level.objects[hero.ux]?.[hero.uy] || []) {
        if (object.otyp === POT_WATER && !(bless ? object.blessed : object.cursed)) {
            if (bless) blessObjectState(object);
            else await curseObject(object);
            object.bknown = known;
            changed += object.quan;
        } else if (object.oclass === 8) other = true;
    }
    if (!heroIsBlind(game) && changed) {
        const subject = other ? (changed > 1 ? 'Some of the' : 'One of the') : 'The';
        await pline(`${subject} potion${other || changed > 1 ? 's' : ''} on the altar glow${changed > 1 ? '' : 's'} ${displayColorName(bless ? 'light blue' : 'black')} for a moment.`);
    }
    return changed > 0;
}

async function reviveAltarPet() {
    const game = requireInitializedGame();
    const hero = game.u;
    const object = (game.level.objects[hero.ux]?.[hero.uy] || []).find(object =>
        [CORPSE, STATUE].includes(object.otyp)
        && object.oextra?.omonst?.mtame && !object.oextra.omonst.isminion);
    if (!object) return;
    if (object.otyp === CORPSE) await reviveCorpseForHero(object);
    else await animateStatue(object, hero.ux, hero.uy, { magic: true });
}

function currentAltar() {
    const game = requireInitializedGame();
    const location = game.level.requireAt(game.u.ux, game.u.uy);
    return location.typ === ALTAR ? location : null;
}

function inHell() {
    const game = requireInitializedGame();
    return !!game.dungeons?.[game.u.uz.dnum]?.flags?.hellish;
}

function luck() {
    return (game.u.uluck || 0) + (game.u.moreluck || 0);
}
