// C timeout.c:run_timers(). Used by ordinary turns and level arrivals.

import { runClaimedCorpseRevivalTimer } from './corpse_revival.js';
import { canSpotMonster, newsym, plineWithContinuation } from './display.js';
import { finishEggHatchTimer, runClaimedEggHatchTimer } from './egg.js';
import { finishFigurineTimer, runClaimedFigurineTimer } from './figurine.js';
import { game } from './gstate.js';
import { finishGlobTimer, runClaimedGlobTimer } from './glob.js';
import { finishMeltIce } from './ice.js';
import { runClaimedObjectBurnTimer } from './light.js';
import {
    finishBuriedZombieTimer, runClaimedMeltIceTimer, runClaimedObjectRotTimer,
} from './mklev.js';
import { monsterTypeName } from './monster_data.js';
import { wakeMonstersNearWithMessages } from './monster_wake.js';
import { claimNextDueObjectTimer, LEVEL_TIMER_KIND, OBJECT_TIMER_KIND } from './object_timers.js';
import { cansee } from './vision.js';

export async function runDueTimers() {
    while (!game.program_state?.gameover) {
        const timer = claimNextDueObjectTimer(game, game.moves);
        if (!timer) return;
        await runObjectTimer(timer, game.moves);
    }
}

// The caller has removed this timer from the queue. Its callback may add or
// cancel timers, so the next due timer must be selected after it finishes.
export async function runObjectTimer(claimed, currentTurn) {
    const kind = claimed.timer.kind;
    if (kind === OBJECT_TIMER_KIND.BURN_OBJECT)
        return runClaimedObjectBurnTimer(claimed, game, currentTurn);
    if (kind === OBJECT_TIMER_KIND.HATCH_EGG) {
        const event = await runClaimedEggHatchTimer(claimed, game, currentTurn);
        if (event?.message) await plineWithContinuation(event.message);
        if (event?.followupMessage) await plineWithContinuation(event.followupMessage);
        return finishEggHatchTimer(event, game, currentTurn);
    }
    if (kind === OBJECT_TIMER_KIND.SHRINK_GLOB) {
        const event = runClaimedGlobTimer(claimed, game, currentTurn);
        if (event?.message) await plineWithContinuation(event.message);
        const finished = finishGlobTimer(event, game, currentTurn);
        if (finished?.followupMessage) await plineWithContinuation(finished.followupMessage);
        return finished;
    }
    if (kind === OBJECT_TIMER_KIND.FIG_TRANSFORM) {
        const event = await runClaimedFigurineTimer(claimed, game, currentTurn);
        for (const message of event?.waterMessages || []) await plineWithContinuation(message);
        if (event?.message) await plineWithContinuation(event.message);
        return finishFigurineTimer(event, game);
    }
    if (kind === OBJECT_TIMER_KIND.REVIVE_MON || kind === OBJECT_TIMER_KIND.ZOMBIFY_MON) {
        const event = await runClaimedCorpseRevivalTimer(claimed, game, currentTurn);
        for (const message of event?.messages || []) await plineWithContinuation(message);
        if (event?.buried) await announceBuriedRevival(event);
        return finishBuriedZombieTimer(event, game);
    }
    if (kind === LEVEL_TIMER_KIND.MELT_ICE_AWAY) {
        return finishMeltIce(runClaimedMeltIceTimer(claimed, game), {
            announce: plineWithContinuation, wake: wakeMonstersNearWithMessages,
        });
    }
    const event = runClaimedObjectRotTimer(claimed, game);
    if (event?.where === 'floor') newsym(event.x, event.y);
    if (kind === OBJECT_TIMER_KIND.ROT_CORPSE && event?.where === 'inventory')
        await plineWithContinuation('Your corpse rots away.');
    return event;
}

async function announceBuriedRevival(event) {
    if (event.kind !== 'revived' || !event.monster) return;
    const { monster, trap } = event;
    if (cansee(monster.mx, monster.my)) {
        let subject = 'Something';
        if (canSpotMonster(monster)) {
            const name = `${monster.saddled ? 'saddled ' : ''}`
                + monsterTypeName(monster.mnum, !!monster.female);
            subject = `${/^[aeiou]/i.test(name) ? 'An' : 'A'} ${name}`;
        }
        if (trap) trap.tseen = true;
        await plineWithContinuation(`${subject} claws itself out of the ground!`);
        newsym(monster.mx, monster.my);
    } else {
        const dx = monster.mx - game.u.ux;
        const dy = monster.my - game.u.uy;
        if (!(game.u.deaf || game.deaf) && dx * dx + dy * dy < 25)
            await plineWithContinuation('You hear scratching noises.');
    }
}
