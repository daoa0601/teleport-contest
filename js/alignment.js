// Hero alignment record changes.
// C ref: attrib.c adjalign().

import { game } from './gstate.js';
import { A_NONE } from './const.js';
import { plineWithContinuation } from './display.js';
import { recordGameLogEvent } from './gamelog.js';
import { retouchEquipment } from './hero_retouch.js';
import { HELM_OF_OPPOSITE_ALIGNMENT } from './object_data.js';

export function deityName(alignment, state = game) {
    if (alignment === A_NONE) return 'Moloch';
    const key = alignment > 0 ? 'lawful' : alignment < 0 ? 'chaotic' : 'neutral';
    return state.urole?.gods?.[key] || 'your god';
}

// C attrib.c:uchangealign(A_CG_CONVERT). A helm can hide a permanent
// conversion, but it cannot undo the change to the hero's chosen deity.
export async function convertHeroAlignment(alignment, state = game) {
    const hero = state.u;
    const previous = hero.ualign.type;
    const original = hero.ualignbase?.[1] ?? previous;
    hero.ublessed = 0;
    hero.ualignbase = [alignment, original];
    const name = alignment > 0 ? 'lawful' : alignment < 0 ? 'chaotic' : 'neutral';
    recordGameLogEvent(`permanently converted to ${name}`, { state });
    const helmet = state.uarmh || hero.uarmh;
    if (helmet?.otyp !== HELM_OF_OPPOSITE_ALIGNMENT) hero.ualign.type = alignment;
    await plineWithContinuation(`You have a ${hero.ualign.type !== previous ? 'sudden ' : ''}sense of a new direction.`);
    if (hero.ualign.type !== previous) {
        hero.ualign.record = 0;
        await retouchEquipment(0, { state });
    }
}

export function adjustHeroAlignment(amount, state = game) {
    if (!amount || !state.u?.ualign) return;
    const alignment = state.u.ualign;
    if (amount < 0) {
        alignment.record = (alignment.record || 0) + amount;
        alignment.abuse = (alignment.abuse ?? 0) - amount;
        return;
    }
    const alignmentLimit = 10 + Math.trunc((state.moves || 0) / 200);
    alignment.record = Math.min(
        alignmentLimit, (alignment.record || 0) + amount,
    );
}
