// C fountain.c:wash_hands(), shared by fountain, sink and pool dips.
import { heroFingerName, heroHandName } from './body_parts.js';
import { armorSimpleName } from './armor.js';
import { displayLiquidName, plineWithContinuation as pline } from './display.js';
import { game } from './gstate.js';
import { makePlural } from './object_grammar.js';
import { setPropertyTimeout } from './properties.js';
import { waterDamageObject } from './trap.js';
import type { GameObject } from './object_types.js';
import type { WaterDamageOutcome } from './trap.js';

export type DipTarget = GameObject | 'hands';

export function fingersOrGloves(): string {
    return game.uarmg ? armorSimpleName(game.uarmg) : makePlural(heroFingerName());
}

export async function washHands(): Promise<WaterDamageOutcome> {
    const glib = (game.u.glibTurns ?? 0) > 0;
    await pline(`You wash your ${game.uarmg ? 'gloved ' : ''}${makePlural(heroHandName())} in the ${displayLiquidName('water')}.`);
    if (glib) {
        setPropertyTimeout('glib', 0);
        game.context.botl = true;
        await pline(`Your ${fingersOrGloves()} are no longer slippery.`);
    }
    const result = game.uarmg ? await waterDamageObject(game.uarmg, [], game,
        { force: true, publish: pline }) : 'nothing';
    return glib && result === 'nothing' ? 'greased' : result;
}
