// Freezing and melting water.
// C refs: zap.c melt_ice(), melt_ice_away(), and start_melt_ice_timeout().

import {
    canSeeMonster, canSpotMonster, newsym, plineWithContinuation,
} from './display.js';
import { game } from './gstate.js';
import { heroEntersPool } from './hack.js';
import { G_GENOD, IS_POOL } from './const.js';
import {
    disturbBuriedZombieTimers, finishMeltIceBoulderLifeSaving,
    killMonsterOnMeltingIce, meltIceAt, runNextMeltIceBoulder,
} from './mklev.js';
import {
    lifeSaveMonster, wornMonsterLifeSaver,
} from './mondeath.js';
import { rollMonsterPoolReaction } from './mon.js';
import { splitMonster } from './monster_clone.js';
import { MONSTER_FLAGS1, MONSTER_NAME } from './monster_data.js';
import { LEVEL_TIMER_KIND } from './object_timers.js';
import { randomMonsterRelocation } from './teleport.js';
import { monsterTeleportRestricted } from './teleport_rules.js';
import { cansee } from './vision.js';

const M1_TPORT = 0x02000000;

async function finishMonsterOnMeltedIce(
    event, { announce, saveMonster, visible },
) {
    const monster = event.occupant;
    const location = game.level?.at?.(event.x, event.y);
    if (!monster || monster.dead || (monster.mhp ?? 1) <= 0
        || !location || !IS_POOL(location.typ)) return null;

    const seen = visible ?? cansee(event.x, event.y);
    const name = MONSTER_NAME[monster.mnum] || 'monster';
    const reaction = rollMonsterPoolReaction(monster, game);
    if (reaction.kind === 'safe') return reaction;
    if (reaction.kind === 'split') {
        reaction.clone = splitMonster(
            monster, game, { monsterMoving: true },
        );
        return reaction;
    }
    if (reaction.kind === 'rust') {
        monster.mhp = (monster.mhp ?? 1) - reaction.damage;
        if (monster.mhpmax > reaction.damage)
            monster.mhpmax -= reaction.damage;
        if (monster.mhp > 0) {
            if (seen) await announce(`The ${name} rusts.`);
            return reaction;
        }
    }

    const canTeleport = reaction.kind === 'drown'
        && !!((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_TPORT);
    if (canTeleport && !monsterTeleportRestricted(monster, game)) {
        const oldx = monster.mx;
        const oldy = monster.my;
        const relocation = randomMonsterRelocation(monster, game);
        if (relocation) {
            newsym(oldx, oldy);
            newsym(monster.mx, monster.my);
            return { survived: true, relocation };
        }
    }

    if (seen) {
        if (reaction.kind === 'rust') {
            await announce(`The ${name} rusts.`);
        } else {
            await announce(event.monsterMoving
                ? `The ${name} drowns.`
                : `You drown the ${name}.`);
        }
    }

    const amulet = wornMonsterLifeSaver(monster);
    if (amulet) {
        monster.mhp = 0;
        const resolution = await saveMonster(monster, amulet, {
            visible: seen,
            spotted: canSeeMonster(monster, event.x, event.y),
            genocided: !!((game.mvitals?.[monster.mnum]?.mvflags ?? 0)
                & G_GENOD),
            petSpotted: canSpotMonster(monster),
        });
        if (resolution.survived) {
            if (reaction.kind === 'rust') {
                return { survived: true, lifeSaving: resolution };
            }
            const oldx = monster.mx;
            const oldy = monster.my;
            const relocation = randomMonsterRelocation(monster, game);
            if (relocation) {
                newsym(oldx, oldy);
                newsym(monster.mx, monster.my);
            }
            return { survived: true, lifeSaving: resolution, relocation };
        }
    }

    const death = killMonsterOnMeltingIce(monster, game);
    event.occupantDeath = death;
    return { survived: false, death };
}

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
    const heroAt = game.u?.ux === event.x && game.u?.uy === event.y;
    if (heroAt) {
        await heroEntersPool({
            publish: announce,
        });
    } else {
        await finishMonsterOnMeltedIce(event, {
            announce,
            saveMonster,
            visible: options.visible,
        });
    }
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
