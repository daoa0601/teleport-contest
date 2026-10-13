// Hero alignment record changes.
// C ref: attrib.c adjalign().
import { game, requireLiveGame } from './gstate.js';
import { rn2Display } from './rng.js';
import { roles } from './roles.js';
import { heroIsHallucinating } from './senses.js';
import { A_NONE } from './const.js';
import { plineWithContinuation } from './display.js';
import { recordGameLogEvent } from './gamelog.js';
import { retouchEquipment } from './hero_retouch.js';
import { HELM_OF_OPPOSITE_ALIGNMENT } from './object_data.js';
export function deityName(alignment, state = game) {
    if (alignment === A_NONE)
        return 'Moloch';
    const key = alignment > 0 ? 'lawful' : alignment < 0 ? 'chaotic' : 'neutral';
    return state.urole?.gods?.[key] || 'your god';
}
// C pray.c:halu_gname(). Both selection steps use the display RNG.
const HALLUCINATED_GODS = [
    'the Flying Spaghetti Monster', 'Eris', 'the Martians', 'Xom',
    'AnDoR dRaKoN', 'the Central Bank of Yendor', 'Tooth Fairy', 'Om',
    'Yawgmoth', 'Morgoth', 'Cthulhu', 'the Ori', 'destiny',
    'your Friend the Computer',
];
export function hallucinatedDeityName(alignment, state = game, hallucinating = heroIsHallucinating(state)) {
    requireLiveGame(state);
    if (!hallucinating)
        return deityName(alignment, state);
    if (!state.urole)
        throw new Error('Hallucinated deity names require a selected hero role');
    let gods;
    do {
        const role = roles[rn2Display(roles.length)];
        if (!role)
            throw new Error('No hallucinated deity role was selected');
        // C installs the current Priest's borrowed pantheon in roles[].
        // JS keeps it on the live role instead of mutating the shared table.
        gods = role.key === state.urole.key ? state.urole.gods : role.gods;
    } while (!gods?.lawful);
    const choice = rn2Display(9);
    const name = choice < 2 ? gods.lawful
        : choice < 4 ? gods.neutral
            : choice < 6 ? gods.chaotic
                : choice < 8 ? HALLUCINATED_GODS[rn2Display(HALLUCINATED_GODS.length)]
                    : 'Moloch';
    if (name === undefined)
        throw new Error('No hallucinated deity name was selected');
    return name.replace(/^_/, '');
}
// C attrib.c:uchangealign(A_CG_CONVERT). A helm can hide a permanent
// conversion, but it cannot undo the change to the hero's chosen deity.
export async function convertHeroAlignment(alignment, state = game) {
    const hero = state.u;
    const current = hero.ualign;
    if (!current)
        throw new Error('Hero alignment is not initialized');
    const previous = current.type;
    const original = hero.ualignbase?.[1] ?? previous;
    hero.ublessed = 0;
    state.context.botl = true;
    hero.ualignbase = [alignment, original];
    const name = alignment > 0 ? 'lawful' : alignment < 0 ? 'chaotic' : 'neutral';
    recordGameLogEvent(`permanently converted to ${name}`, { state });
    const helmet = state.uarmh || hero.uarmh;
    if (helmet?.otyp !== HELM_OF_OPPOSITE_ALIGNMENT)
        current.type = alignment;
    await plineWithContinuation(`You have a ${current.type !== previous ? 'sudden ' : ''}sense of a new direction.`);
    if (current.type !== previous) {
        current.record = 0;
        await retouchEquipment(0, { state });
    }
}
export function adjustHeroAlignment(amount, state = game) {
    if (!amount || !state.u?.ualign)
        return;
    const alignment = state.u.ualign;
    if (amount < 0) {
        alignment.record = (alignment.record || 0) + amount;
        alignment.abuse = (alignment.abuse ?? 0) - amount;
        return;
    }
    const alignmentLimit = 10 + Math.trunc((state.moves || 0) / 200);
    alignment.record = Math.min(alignmentLimit, (alignment.record || 0) + amount);
}
//# sourceMappingURL=alignment.js.map