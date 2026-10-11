// C artifact.c:set_artifact_intrinsic(), Sting_effects(), glow_verb().
import { artifactById, artifactGlowColor, artifactWarningMask } from './artifacts.js';
import { W_WEP } from './const.js';
import { displayColorName, plineWithContinuation, see_monsters } from './display.js';
import { game, requireLiveGame } from './gstate.js';
import { verbForSubject } from './object_grammar.js';
import { grantWornProperty, removeWornProperty, wornObjectGrantsProperty } from './properties.js';
import { heroIsBlind } from './senses.js';
function glowStrength(count) {
    return count > 12 ? 3 : count > 4 ? 2 : count > 0 ? 1 : 0;
}
export function artifactGlowVerb(count, continuous = false) {
    const verbs = ['quiver', 'flicker', 'glimmer', 'gleam'];
    const verb = verbs[glowStrength(count)];
    return continuous ? `${verb}ing` : verb;
}
export function wieldedArtifactWarns(state = game) {
    const object = state.uwep;
    return !!(object &&
        (object.owornmask ?? 0) & W_WEP &&
        artifactWarningMask(object, state) &&
        wornObjectGrantsProperty(object, 'warnOfMonster', state));
}
export async function setArtifactWarningWielded(object, active, state = game) {
    const mask = artifactWarningMask(object, state);
    if (!mask)
        return;
    requireLiveGame(state);
    const warning = (state.context.warntype ||= { obj: 0, polyd: 0, speciesidx: -1 });
    if (active) {
        grantWornProperty('warnOfMonster', object, 'uwep', state);
        warning.obj = (warning.obj || 0) | mask;
    }
    else {
        removeWornProperty('warnOfMonster', object, 'uwep', state);
        warning.obj = (warning.obj || 0) & ~mask;
    }
    await see_monsters();
}
// The census owns count commits. -1 announces a sight change without recounting.
export async function artifactWarningFeedback(count, { beforeGlow = null } = {}) {
    const object = game.uwep;
    if (!object || !artifactWarningMask(object))
        return;
    const previous = game.warn_obj_cnt;
    const oldStrength = glowStrength(previous);
    const newStrength = glowStrength(count);
    const blind = heroIsBlind();
    const artifact = artifactById(object.oartifact);
    if (!artifact)
        throw new Error('Warning weapon requires a known artifact');
    const name = artifact.name.replace(/^the /i, '');
    if (count === -1 && previous > 0) {
        await plineWithContinuation(`${name} is ${artifactGlowVerb(blind ? 0 : previous, true)}.`);
    }
    else if (newStrength > 0 && newStrength !== oldStrength) {
        if (beforeGlow)
            await beforeGlow();
        if (!blind) {
            const verb = verbForSubject(null, artifactGlowVerb(count));
            const color = displayColorName(artifactGlowColor(object));
            await plineWithContinuation(`${name} ${verb} ${color}${newStrength > oldStrength ? '!' : '.'}`);
        }
        else if (oldStrength === 0) {
            await plineWithContinuation(`${name} quivers slightly.`);
        }
    }
    else if (count === 0 && previous > 0) {
        await plineWithContinuation(`${name} stops ${artifactGlowVerb(blind ? 0 : previous, true)}.`);
    }
}
//# sourceMappingURL=artifact_warning.js.map