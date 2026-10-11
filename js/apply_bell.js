// C apply.c:use_bell(). Command admission and turn scheduling belong to doapply.
import { game, requireLiveGame } from './gstate.js';
import { A_NONE, G_GONE, MM_NOMSG, NO_MINVENT, TT_BURIEDBALL } from './const.js';
import { BELL_OF_OPENING } from './object_data.js';
import { MONSTER_NAME } from './monster_data.js';
import { plineWithContinuation } from './display.js';
import { objectName, objectNameIsPlural } from './objnam.js';
import { makePlural } from './object_grammar.js';
import { objectResistsDestruction } from './object_state.js';
import { consumeInventoryItem } from './invent.js';
import { consumeObjectCharge } from './object_charge.js';
import { learnObjectType } from './object_knowledge.js';
import { heroIsOnStairs, isInvocationPosition } from './invocation_position.js';
import { endVoluntaryMultiTurn } from './command_state.js';
import { unpunishHero } from './punishment.js';
import { freeHeroFromBuriedBall } from './hero_traps.js';
import { findit } from './detect.js';
import { openit } from './magic_opening.js';
import { summonUndead } from './undead_summoning.js';
import { makemonAt, mkclassAligned } from './mklev.js';
import { monsterName } from './monster_name.js';
import { adjustMonsterSpeed } from './monster_speed.js';
import { wakeMonstersNearWithMessages } from './monster_wake.js';
import { rn2, rnd } from './rng.js';
import { requireInitializedHero } from './hero_types.js';
const S_NYMPH = 14;
const NYMPHS = ['wood nymph', 'water nymph', 'mountain nymph']
    .map(name => MONSTER_NAME.indexOf(name));
function bellName(object, state) {
    const name = objectName(object, state);
    return `the ${objectNameIsPlural(object, state) ? makePlural(name) : name}`;
}
function bellAction(object, verb, state) {
    const name = bellName(object, state);
    return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${objectNameIsPlural(object, state) ? verb : verb === 'have' ? 'has' : `${verb}s`}`;
}
export async function useBell(object, { state = game } = {}) {
    requireLiveGame(state);
    requireInitializedHero(state.u);
    const ordinary = object.otyp !== BELL_OF_OPENING || !object.spe;
    const invoking = object.otyp === BELL_OF_OPENING
        && isInvocationPosition(state.u.ux, state.u.uy, state) && !heroIsOnStairs(state);
    let wake = false, learn = false;
    let remainingObject = object;
    await plineWithContinuation(`You ring ${bellName(object, state)}.`);
    if (state.u.uinwater || state.underwater || state.u.underwater
        || (state.u.uswallow && ordinary)) {
        await plineWithContinuation('But the sound is muffled.');
    }
    else if (invoking && ordinary) {
        await plineWithContinuation('But it makes no sound.');
        learn = true;
    }
    else if (ordinary) {
        if (object.cursed && !rn2(4)
            && NYMPHS.every(species => !((state.mvitals?.[species]?.mvflags || 0) & G_GONE))) {
            const species = mkclassAligned(S_NYMPH, 0, A_NONE);
            const nymph = await makemonAt(species, state.u.ux, state.u.uy, NO_MINVENT | MM_NOMSG);
            if (nymph) {
                await plineWithContinuation(`You summon ${monsterName(nymph, { article: 'a', state })}!`);
                if (!objectResistsDestruction(object, 93, 100)) {
                    await plineWithContinuation(`${bellAction(object, 'have', state)} shattered!`);
                    await consumeInventoryItem(object, state);
                    remainingObject = null;
                }
                else {
                    const fate = rn2(3);
                    if (fate === 1)
                        adjustMonsterSpeed(nymph, 2);
                    else if (fate === 2) {
                        // Native nomul() delay is involuntary, with no recovery text
                        // and no sleep state or invented reason.
                        endVoluntaryMultiTurn(state);
                        state._helplessTurns = rnd(2);
                        state._helplessReason = null;
                        state._helplessDoneMessage = '';
                    }
                }
            }
        }
        wake = true;
    }
    else {
        await consumeObjectCharge(object, { state });
        if (state.u.uswallow) {
            if (object.cursed)
                await plineWithContinuation('Nothing happens.');
            else
                await openit(state);
        }
        else if (object.cursed) {
            await summonUndead({ x: state.u.ux, y: state.u.uy }, { state, flags: NO_MINVENT });
            wake = true;
        }
        else if (invoking) {
            await plineWithContinuation(`${bellAction(object, 'issue', state)} an unsettling shrill sound...`);
            object.age = state.moves;
            learn = true;
            wake = true;
        }
        else if (object.blessed) {
            let opened = 0;
            if (state.uchain || state.u.uchain) {
                await unpunishHero(state);
                opened++;
            }
            else if (state.u.utrap && state.u.utraptype === TT_BURIEDBALL) {
                await freeHeroFromBuriedBall(state);
                opened++;
            }
            opened += await openit(state);
            if (state.program_state.gameover)
                return {
                    spentTime: true, heroDied: true, object: remainingObject,
                };
            await plineWithContinuation(!opened ? 'Nothing happens.'
                : opened === 1 ? 'Something opens...' : 'Things open around you...');
            learn = opened !== 0;
        }
        else {
            learn = (await findit()) !== 0;
            if (!learn)
                await plineWithContinuation('Nothing happens.');
        }
    }
    if (learn) {
        learnObjectType(BELL_OF_OPENING, state);
        object.known = true;
    }
    if (wake)
        await wakeMonstersNearWithMessages(state.u.ux, state.u.uy, state.u.ulevel * 20, state, plineWithContinuation, { petCall: true });
    return { spentTime: true, heroDied: !!state.program_state.gameover, object: remainingObject };
}
//# sourceMappingURL=apply_bell.js.map