// Freezing and melting water.
// C refs: zap.c melt_ice(), melt_ice_away(), and start_melt_ice_timeout().

import {
    canSeeMonster, canSpotMonster, newsym, plineWithContinuation,
} from './display.js';
import { game } from './gstate.js';
import {
    disturbBuriedZombieTimers, finishMeltIceBoulderLifeSaving, meltIceAt,
    runNextMeltIceBoulder,
} from './mklev.js';
import { lifeSaveMonster } from './mondeath.js';
import { LEVEL_TIMER_KIND } from './object_timers.js';
import { cansee } from './vision.js';

export function meltIceTimerMessage(event, options = {}) {
    if (event?.kind !== LEVEL_TIMER_KIND.MELT_ICE_AWAY) return null;
    const visible = options.visible ?? cansee(event.x, event.y);
    const heroAt = options.heroAt
        ?? (game.u?.ux === event.x && game.u?.uy === event.y);
    return visible || heroAt ? 'Some ice melts away.' : null;
}

export function meltIceBoulderSettleMessage(event, options = {}) {
    if (event?.kind !== LEVEL_TIMER_KIND.MELT_ICE_AWAY
        || !event.pendingBoulder) return null;
    const visible = options.visible ?? cansee(event.x, event.y);
    return visible ? 'A boulder settles...' : null;
}

export function meltIceBoulderSplashMessage(outcome, options = {}) {
    if (outcome?.kind !== 'melt-ice-boulder') return null;
    const heroInWater = options.heroInWater ?? !!game.u?.uinwater;
    if (heroInWater) return null;
    const visible = options.visible ?? cansee(outcome.x, outcome.y);
    if (visible) {
        const action = outcome.fillsUp ? 'fills' : 'falls into';
        return `There is a large splash as the boulder ${
            action
        } the ${outcome.waterBody}.`;
    }
    const deaf = options.deaf ?? !!(game.u?.deaf || game.deaf);
    return deaf ? null : 'You hear a splash.';
}

export function meltIceBoulderSinkMessage(outcome, options = {}) {
    if (outcome?.kind !== 'melt-ice-boulder' || outcome.fillsUp) return null;
    const visible = options.visible ?? cansee(outcome.x, outcome.y);
    const verbose = options.verbose ?? game.flags?.verbose ?? true;
    return visible && verbose ? 'It sinks without a trace!' : null;
}

export async function finishMeltIce(event, options = {}) {
    if (!event || event.meltPresentationFinished) return event;
    const announce = options.announce ?? plineWithContinuation;
    const repaint = options.repaint ?? newsym;
    const wake = options.wake ?? (async () => {});
    const disturb = options.disturb ?? disturbBuriedZombieTimers;
    const saveMonster = options.lifeSaveMonster ?? lifeSaveMonster;
    const heroInWater = options.heroInWater ?? !!game.u?.uinwater;

    const message = Object.hasOwn(options, 'message')
        ? options.message : meltIceTimerMessage(event, options);
    const lastMessage = options.lastMessage ?? game._last_message;
    if (message && lastMessage !== message) await announce(message);
    if (event.pendingBoulder) {
        const settles = meltIceBoulderSettleMessage(event, options);
        if (settles) await announce(settles);
    }
    while (event.pendingBoulder || event.pendingBoulderOutcome) {
        const outcome = runNextMeltIceBoulder(event, game);
        if (!outcome) break;
        if (outcome.pendingOccupantLifeSaving) {
            const monster = outcome.pendingOccupantLifeSaving.monster;
            const visible = options.visible ?? cansee(event.x, event.y);
            const spotted = options.occupantSpotted
                ?? canSeeMonster(monster, event.x, event.y);
            const presentation = { visible, spotted };
            if (outcome.pendingOccupantLifeSaving.genocided)
                presentation.genocided = true;
            if (monster.mtame > 0) {
                presentation.petSpotted = options.occupantPetSpotted
                    ?? canSpotMonster(monster);
            }
            const resolution = await saveMonster(
                monster, outcome.pendingOccupantLifeSaving.amulet,
                presentation,
            );
            finishMeltIceBoulderLifeSaving(
                event, outcome, resolution, game,
            );
        }
        if (outcome.fillsUp) repaint(event.x, event.y);
        const splash = meltIceBoulderSplashMessage(outcome, {
            ...options, heroInWater,
        });
        if (splash) await announce(splash);
        if (!heroInWater) {
            await wake(event.x, event.y, 40);
            disturb(event.x, event.y, game);
        }
        const sinks = meltIceBoulderSinkMessage(outcome, options);
        if (sinks) await announce(sinks);
    }
    if (event.boulderOutcomes.length) repaint(event.x, event.y);
    event.meltPresentationFinished = true;
    return event;
}

export function meltIce(x, y, options = {}) {
    const visible = options.visible ?? cansee(x, y);
    const heroAt = options.heroAt
        ?? (game.u?.ux === x && game.u?.uy === y);
    const message = Object.hasOwn(options, 'message')
        ? options.message
        : visible || heroAt ? 'The ice crackles and melts.' : null;
    return finishMeltIce(meltIceAt(x, y, game), {
        ...options,
        message,
    });
}
