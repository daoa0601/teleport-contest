// C apply.c:use_towel() and weapon.c:dry_a_towel().
import { armorSimpleName } from './armor.js';
import { heroFaceName, heroHandName } from './body_parts.js';
import { TIMEOUT } from './const.js';
import { plineWithContinuation as pline } from './display.js';
import { gulpBlindnessCheck } from './engulf_blindness.js';
import { removeEyewear } from './eyewear.js';
import { game, requireLiveGame } from './gstate.js';
import { dropInventoryObjectAtHero } from './hero_drop.js';
import { LENSES } from './object_data.js';
import { makePlural } from './object_grammar.js';
import { ownedObjectName } from './objnam.js';
import { rn2, rn1 } from './rng.js';
import { heroIsBlinded, setHeroBlindnessTurns } from './senses.js';
import { makeBlinded } from './sight_change.js';
import { heroHasFreeHand, isWetTowel } from './weapon_type.js';
import type { GameObject } from './object_types.js';
import type { GameState } from './game_state.js';

export async function useTowel(object: GameObject, { state = game }: { state?: GameState } = {}) {
    requireLiveGame(state);
    const result = { spentTime: false, heroDied: false, object };
    const hands = makePlural(heroHandName(state));
    const eyewear = state.ublindf || state.u.ublindf;
    if (!heroHasFreeHand(state)) {
        await pline(`You have no free ${heroHandName(state)}!`);
        return result;
    }
    if (object === eyewear) {
        await pline("You cannot use it while you're wearing it!");
        return result;
    }
    if (object.cursed) {
        const mishap = rn2(3);
        if (mishap === 2) {
            const old = state.u.glibTurns || 0;
            setSlipperyHands(old + rn1(10, 3), state);
            await pline(`Your ${hands} ${old ? 'are filthier than ever' : 'get slimy'}!`);
        } else if (mishap === 1) {
            if (!eyewear) {
                const old = state.u.ucreamed || 0;
                state.u.ucreamed = old + rn1(10, 3);
                await pline(`Yecch!  Your ${heroFaceName(state)} ${old ? 'has more' : 'now has'} gunk on it!`);
                await makeBlinded((state.u.blindTurns || 0) + state.u.ucreamed - old, { state });
            } else {
                const name = eyewear.otyp === LENSES ? 'lenses'
                    : eyewear.otyp === object.otyp ? 'other towel' : 'blindfold';
                if (eyewear.cursed) await pline(`You push your ${name} ${rn2(2) ? 'cock-eyed' : 'crooked'}.`);
                else {
                    await pline(`You push your ${name} off.`);
                    await removeEyewear(null, { state });
                    if (!state.program_state.gameover) await dropInventoryObjectAtHero(eyewear, { state });
                }
            }
        }
        if (mishap) {
            result.spentTime = true;
            if (!state.program_state.gameover) await dryTowel(object, -1, { state, verbose: object === state.uwep });
            result.heroDied = !!state.program_state.gameover;
            return result;
        }
    }
    if ((state.u.glibTurns ?? 0) > 0 || state.u.glib) {
        setSlipperyHands(0, state);
        await pline(`You wipe off your ${state.uarmg ? armorSimpleName(state.uarmg, state) : hands}.`);
    } else if (state.u.ucreamed) {
        setHeroBlindnessTurns((state.u.blindTurns || 0) - state.u.ucreamed, state);
        state.u.ucreamed = 0;
        if (!heroIsBlinded(state)) {
            await pline("You've got the glop off.");
            const gulp = await gulpBlindnessCheck({ state });
            if (!gulp.triggered && !gulp.died) {
                setHeroBlindnessTurns(1, state);
                await makeBlinded(0, { state });
            }
        } else await pline(`Your ${heroFaceName(state)} feels clean now.`);
    } else {
        await pline(`Your ${heroFaceName(state)} and ${hands} are already clean.`);
        return result;
    }
    result.spentTime = true;
    result.heroDied = !!state.program_state.gameover;
    if (!result.heroDied) await dryTowel(object, -1, { state, verbose: object === state.uwep });
    return result;
}

export function setSlipperyHands(turns: number, state: GameState = game) {
    if (!!state.u.glib !== (turns > 0)) state.context.botl = true;
    state.u.glibTurns = Math.max(0, Math.min(TIMEOUT, turns));
    state.u.glib = state.u.glibTurns > 0;
}

export async function dryTowel(
    object: GameObject, amount: number,
    { state = game, verbose = false }: { state?: GameState; verbose?: boolean } = {},
) {
    if (!isWetTowel(object)) return;
    const wetness = amount < 0 ? object.spe + amount : amount;
    if (wetness < object.spe && verbose)
        await pline(`${ownedObjectName(object, state)} dries${wetness ? '' : ' out'}.`);
    object.spe = Math.max(0, Math.min(7, wetness));
    if (object === state.uwep || object === state.u.uwep) state._unweapon = !isWetTowel(object);
}
