import { game } from './gstate.js';
import { newsym, plineWithContinuation, canSpotMonster } from './display.js';
import { makemonNear } from './mklev.js';
import { STRAT_WAITMASK, MM_NOWAIT } from './const.js';

// C wizard.c:resurrect(). Recreate the Wizard when no live one is on this level.
export async function resurrectWizard() {
    const existing = game.level?.monsters?.find(monster =>
        !monster.dead && monster.iswiz);
    if (existing) return existing;

    const wizard = await makemonNear(
        285, game.u.ux, game.u.uy, MM_NOWAIT,
    );
    if (!wizard) return null;
    wizard.mrevived = 1;
    wizard.mtame = 0;
    wizard.mpeaceful = 0;
    wizard.mstrategy = (wizard.mstrategy || 0) & ~STRAT_WAITMASK;
    newsym(wizard.mx, wizard.my);
    if (canSpotMonster(wizard)) {
        await plineWithContinuation(
            'The Wizard of Yendor suddenly appears next to you!',
        );
    }
    if (!game.deaf && !game.u?.deaf) {
        await plineWithContinuation(
            'A voice booms out...  "So thou thought thou couldst kill me, fool."',
        );
    }
    return wizard;
}
