// C mondata.c:can_chant(), shared by reading and calling on a deity.
// C pline.c:You_feel(), You_hear(), and You_see() message wording.
import { game } from './gstate.js';
import { MONSTER_FLAGS1, MONSTER_SOUND } from './monster_data.js';
import { heroIsBlind, heroIsDeaf } from './senses.js';
import { heroIsUnaware } from './hero_sleep.js';
const M1_NOHEAD = 0x00008000;
const MS_SILENT = 0;
const MS_BUZZ = 10;
const MS_BURBLE = 16;
// C pline.c:436-452 You_hear().  Pure formatter: returns the exact line
// to publish, or null when the sound is suppressed.  An awake deaf hero or
// disabled acoustics hears nothing; an unaware (sleeping, fainted,
// unconscious) hero only dreams the sound; being underwater muffles it.
export function formatHeardMessage(text, state = game) {
    const deaf = heroIsDeaf(state);
    const unaware = heroIsUnaware(state);
    if ((deaf && !unaware) || state.flags?.acoustics === false)
        return null;
    if (state.underwater || state.u?.uinwater)
        return `You barely hear ${text}`;
    if (unaware)
        return `You dream that you hear ${text}`;
    return `You hear ${text}`;
}
// Keep suppression at the message boundary without changing the caller's effects.
export async function publishHeardMessage(text, publish, state = game) {
    const message = formatHeardMessage(text, state);
    if (message)
        await publish(message);
}
// C pline.c:You_see(). Callers decide whether the event can be seen.
export function formatSeenMessage(text, state = game) {
    if (heroIsUnaware(state))
        return `You dream that you see ${text}`;
    if (heroIsBlind(state))
        return `You sense ${text}`;
    return `You see ${text}`;
}
// C pline.c:You_feel(). Sensations reach an unaware hero as dreams.
export function formatFeltMessage(text, state = game) {
    return `${heroIsUnaware(state) ? 'You dream that you feel' : 'You feel'} ${text}`;
}
export function heroCanChant(state = game) {
    const hero = state.u;
    if (hero.strangled || (hero.strangledTurns ?? 0) > 0)
        return false;
    const mnum = hero.umonnum;
    if (mnum === undefined || !Number.isInteger(mnum))
        return true;
    const sound = MONSTER_SOUND[mnum] ?? MS_SILENT;
    return sound !== MS_SILENT
        && sound !== MS_BUZZ
        && sound !== MS_BURBLE
        && !((MONSTER_FLAGS1[mnum] ?? 0) & M1_NOHEAD);
}
//# sourceMappingURL=hero_speech.js.map