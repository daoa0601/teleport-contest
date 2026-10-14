// C artifact.c:set_artifact_intrinsic(), Sting_effects(), glow_verb().

import { artifactById, artifactGlowColor, artifactWarningMask } from './artifacts.js';
import { DOOR, D_TRAPPED, W_WEP, isok } from './const.js';
import { displayColorName, glyphAt, plineWithContinuation, see_monsters } from './display.js';
import { isContainer } from './container.js';
import { game, requireLiveGame } from './gstate.js';
import { verbForSubject } from './object_grammar.js';
import { grantWornProperty, removeWornProperty, wornObjectGrantsProperty } from './properties.js';
import { heroIsBlind } from './senses.js';
import type { GameObject } from './object_types.js';
import type { GameState } from './game_state.js';

function glowStrength(count: number): 0 | 1 | 2 | 3 {
    return count > 12 ? 3 : count > 4 ? 2 : count > 0 ? 1 : 0;
}

export function artifactGlowVerb(count: number, continuous = false): string {
    const verbs = ['quiver', 'flicker', 'glimmer', 'gleam'] as const;
    const verb = verbs[glowStrength(count)];
    return continuous ? `${verb}ing` : verb;
}

export function wieldedArtifactWarns(state: GameState = game): boolean {
    const object = state.uwep;
    return !!(
        object &&
        (object.owornmask ?? 0) & W_WEP &&
        artifactWarningMask(object, state) &&
        wornObjectGrantsProperty(object, 'warnOfMonster', state)
    );
}

export async function setArtifactWarningWielded(
    object: GameObject,
    active: boolean,
    state: GameState = game,
): Promise<void> {
    const mask = artifactWarningMask(object, state);
    if (!mask) return;
    requireLiveGame(state);
    const warning = (state.context.warntype ||= { obj: 0, polyd: 0, speciesidx: -1 });
    if (active) {
        grantWornProperty('warnOfMonster', object, 'uwep', state);
        warning.obj = (warning.obj || 0) | mask;
    } else {
        removeWornProperty('warnOfMonster', object, 'uwep', state);
        warning.obj = (warning.obj || 0) & ~mask;
    }
    await see_monsters();
}

// The census owns count commits. -1 announces a sight change without recounting.
export async function artifactWarningFeedback(
    count: number,
    { beforeGlow = null }: { beforeGlow?: (() => void | Promise<void>) | null } = {},
) {
    const object = game.uwep;
    if (!object || !artifactWarningMask(object)) return;
    const previous = game.warn_obj_cnt;
    const oldStrength = glowStrength(previous);
    const newStrength = glowStrength(count);
    const blind = heroIsBlind();
    const artifact = artifactById(object.oartifact);
    if (!artifact) throw new Error('Warning weapon requires a known artifact');
    const name = artifact.name.replace(/^the /i, '');
    if (count === -1 && previous > 0) {
        await plineWithContinuation(`${name} is ${artifactGlowVerb(blind ? 0 : previous, true)}.`);
    } else if (newStrength > 0 && newStrength !== oldStrength) {
        if (beforeGlow) await beforeGlow();
        if (!blind) {
            const verb = verbForSubject(null, artifactGlowVerb(count));
            const color = displayColorName(artifactGlowColor(object));
            await plineWithContinuation(
                `${name} ${verb} ${color}${newStrength > oldStrength ? '!' : '.'}`,
            );
        } else if (oldStrength === 0) {
            await plineWithContinuation(`${name} quivers slightly.`);
        }
    } else if (count === 0 && previous > 0) {
        await plineWithContinuation(
            `${name} stops ${artifactGlowVerb(blind ? 0 : previous, true)}.`,
        );
    }
}

// C mkot_trap_warn(): warmth counts locations whose trap is not displayed,
// including trapped doors and containers beneath other floor objects.
export async function warnWithMasterKey(state: GameState = game): Promise<void> {
    const weapon = state.uwep;
    if (state.uarmg || artifactById(weapon?.oartifact, state)?.enumName !== 'MASTER_KEY_OF_THIEVERY') {
        state._magicKeyTrapWarningCount = 0;
        return;
    }
    requireLiveGame(state);
    let count = 0;
    for (let x = state.u.ux - 1; x <= state.u.ux + 1; x++) {
        for (let y = state.u.uy - 1; y <= state.u.uy + 1; y++) {
            if (!isok(x, y) || glyphAt(x, y, state)?.kind === 'trap') continue;
            const spot = state.level?.at(x, y);
            if (state.level?.traps.some(trap => trap.tx === x && trap.ty === y)
                || spot?.typ === DOOR && (spot.doormask & D_TRAPPED)
                || state.level?.objects[x]?.[y]?.some(object => isContainer(object) && object.otrapped))
                count++;
        }
    }
    if (count !== state._magicKeyTrapWarningCount) {
        const heat = ['cool', 'slightly warm', 'warm', 'very warm', 'hot', 'very hot', 'like fire'];
        await plineWithContinuation(`The Key feels ${heat[Math.min(count, 6)]}${count > 3 ? '!' : '.'}`);
    }
    state._magicKeyTrapWarningCount = count;
}
