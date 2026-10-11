// Map updates when the hero gains or loses sight.
// C ref: potion.c toggle_blindness().
import { COLNO, ROWNO } from './const.js';
import { redrawMap, plineWithContinuation, see_monsters, shieldeff, terrain_glyph } from './display.js';
import { heroHasArtifactDefense } from './artifacts.js';
import { heroResistsBlindingLight } from './blinding_attack.js';
import { game, requireLiveGame } from './gstate.js';
import { artifactWarningFeedback, wieldedArtifactWarns } from './artifact_warning.js';
import { setBallAndChainFelt } from './ball.js';
import { heroEyeCount, heroEyeName, heroHasEyes } from './body_parts.js';
import { learnUnseenInventory } from './hero_inventory.js';
import { heroIsUnaware } from './hero_sleep.js';
import { makePlural, verbForSubject } from './object_grammar.js';
import { propertyIsActive } from './properties.js';
import { blindfolded, heroIsBlind, heroIsHallucinating, heroWouldBeBlindWithTimeout, permanentBlind, setHeroBlindnessTurns, } from './senses.js';
import { cansee, vision_recalc } from './vision.js';
export function rememberVisibleTerrain() {
    for (let y = 0; y < ROWNO; y++) {
        for (let x = 1; x < COLNO; x++) {
            const location = game.level?.at(x, y);
            if (!location || location.remembered_glyph || !cansee(x, y))
                continue;
            const terrain = terrain_glyph(location, x, y);
            location.remembered_glyph = { ...terrain, decgfx: terrain.dec };
        }
    }
}
export async function redrawSight() {
    game.vision_full_recalc = 1;
    vision_recalc(0);
    await redrawMap();
}
// C potion.c:make_blinded(). The probe must not change live sight or its caches.
export async function makeBlinded(turns, { state = game, talk = true, publish = plineWithContinuation, } = {}) {
    requireLiveGame(state);
    const old = state.u.blindTurns ?? 0;
    const couldSee = !heroIsBlind(state);
    const canSee = !heroWouldBeBlindWithTimeout(state, turns ? 1 : 0);
    const speaking = talk && !heroIsUnaware(state);
    const hallucinating = heroIsHallucinating(state);
    if (canSee && !couldSee) {
        if (speaking)
            await publish(hallucinating
                ? 'Far out!  Everything is all cosmic again!'
                : 'You can see again.');
    }
    else if (old && !turns && speaking) {
        await publish(maskedBlindnessMessage(true, state));
    }
    if (couldSee && !canSee) {
        if (speaking)
            await publish(hallucinating
                ? 'Oh, bummer!  Everything is dark!  Help!'
                : 'A cloud of darkness falls upon you.');
        if (state.uball || state.u.uball)
            await setBallAndChainFelt(false, state);
    }
    else if (!old && turns && speaking) {
        await publish(maskedBlindnessMessage(false, state));
    }
    setHeroBlindnessTurns(turns, state);
    if (couldSee !== canSee)
        await toggleBlindness(state);
}
function maskedBlindnessMessage(clearing, state) {
    const hallucinating = heroIsHallucinating(state);
    if (!heroHasEyes(state) || permanentBlind(state)) {
        return `You have a ${hallucinating ? 'normal' : 'strange'} feeling `
            + 'for a moment, then it passes.';
    }
    if (blindfolded(state)) {
        const eye = heroEyeName(state);
        const eyes = heroEyeCount(state) === 1 ? eye : makePlural(eye);
        return `Your ${eyes} momentarily ${verbForSubject(eyes, clearing ? 'itch' : 'twitch')}.`;
    }
    return `Your vision seems to ${clearing ? 'brighten' : 'dim'} `
        + `for a moment but is ${hallucinating
            ? clearing ? 'sadder' : 'happier' : 'normal'} now.`;
}
// C potion.c:toggle_blindness(). Call only after effective sight has changed.
export async function toggleBlindness(state = game) {
    requireLiveGame(state);
    const stinging = wieldedArtifactWarns(state);
    // Status is rebuilt at each JS screen flush; vision needs an immediate update.
    state.vision_full_recalc = 1;
    vision_recalc(0);
    if (propertyIsActive('telepathy', state)
        || propertyIsActive('infravision', state) || stinging) {
        await see_monsters();
    }
    if (stinging)
        await artifactWarningFeedback(-1);
    if (!heroIsBlind(state))
        await learnUnseenInventory(state);
}
// C zap.c:flashburn(). The duration is rolled by the caller even when resisted.
export async function flashBurn(duration, viaLightning = false, { state = game, publish = plineWithContinuation, } = {}) {
    requireLiveGame(state);
    if (!heroResistsBlindingLight(state)) {
        await publish('You are blinded by the flash!');
        await makeBlinded(duration, { state, talk: false, publish });
        if (!heroIsBlind(state))
            await publish('Your vision clears.');
        return true;
    }
    if (!viaLightning && heroHasArtifactDefense('blindness', state)) {
        await shieldeff(state.u.ux, state.u.uy, state);
        return true;
    }
    return false;
}
//# sourceMappingURL=sight_change.js.map