// C timeout.c:phaze_dialogue(), region_dialogue(), and their expiry cases.
import { formatFeltMessage } from './hero_speech.js';
import { plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { heroIsBreathless } from './hero_species.js';
import { heroIsSurroundedByRock } from './prayer_trouble.js';
import { hasCarriedProperty, hasIntrinsicProperty, hasInvokedProperty, hasWornProperty, propertyIsActive, propertyTimeout, setPropertyTimeout, } from './properties.js';
import { heroIsInDangerousRegion } from './regions.js';
import { heroIsPolymorphed } from './polyself.js';
export async function wallPassageDialogue(state = game) {
    const turns = propertyTimeout('passesWalls', state);
    if (hasIntrinsicProperty('passesWalls', null, state)
        || hasWornProperty('passesWalls', state)
        || hasCarriedProperty('passesWalls', null, state)
        || hasInvokedProperty('passesWalls', state))
        return;
    if (turns === 5)
        await plineWithContinuation('You start to feel bloated.');
    else if (turns === 3)
        await plineWithContinuation('You are feeling rather flabby.');
}
export async function breathingDialogue(state = game) {
    const turns = propertyTimeout('magicalBreathing', state);
    if (turns !== 5 && turns !== 3)
        return;
    // C temporarily masks only the timed source to ask whether the warning
    // is still relevant to this body and the region it currently occupies.
    setPropertyTimeout('magicalBreathing', 0, state);
    let danger;
    try {
        danger = !heroIsBreathless(state) && heroIsInDangerousRegion(state);
    }
    finally {
        setPropertyTimeout('magicalBreathing', turns, state);
    }
    if (danger)
        await plineWithContinuation(turns === 5
            ? 'You seem to have some trouble breathing.' : 'The air here seems foul.');
}
export async function finishWallPassageTimeout(state = game) {
    if (propertyIsActive('passesWalls', state))
        return;
    await plineWithContinuation(heroIsSurroundedByRock(state)
        ? formatFeltMessage('hemmed in again.', state)
        : `You're back to your ${heroIsPolymorphed(state) ? 'unusual' : 'normal'} self again.`);
}
export async function finishBreathingTimeout(state = game) {
    if (!heroIsBreathless(state) && heroIsInDangerousRegion(state))
        await plineWithContinuation(state.u.poisonResistance
            ? 'You cough.' : 'You cough and spit blood!');
}
//# sourceMappingURL=timeout_warnings.js.map