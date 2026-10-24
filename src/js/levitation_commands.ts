// C ref: do.c dodown() levitation branch (1146-1202) and fountain.c
// floating_above().  The '>' command owner calls this before its stair
// lookup and maps spentTurn to context.move.

import {
    I_SPECIAL, Is_airlevel, Is_waterlevel, TT_INFLOOR, TT_LAVA,
    TIMEOUT, W_ARTI,
} from './const.js';
import { game, requireLiveGame } from './gstate.js';
import { isPoolAt } from './terrain_properties.js';
import type { GameState } from './game_state.js';
import type { Stairway } from './map_types.js';
import type { MessagePublisher } from './display.js';
import { glyphAt, plineWithContinuation } from './display.js';
import {
    hasIntrinsicProperty, hasInvokedProperty, hasRawLevitationSource,
    propertyIsBlocked,
} from './properties.js';
import { floatHeroDown } from './terrain_movement.js';
import { artifactById } from './artifacts.js';
import { rnz } from './rng.js';
import { heroIsBlind } from './senses.js';
import { surfaceName } from './terrain_name.js';

export type LevitationDescentResult =
    | { handled: false; spentTurn: false }
    | { handled: true; spentTurn: boolean };

// C (HLevitation & I_SPECIAL) || (ELevitation & W_ARTI).  Deliberately not
// levitationAtWill(): an uncontrolled source may coexist with a controlled
// one, and '>' still ends only the controlled part.
function heroHasControlledLevitation(state: GameState): boolean {
    return hasIntrinsicProperty('levitation', 'potion', state)
        || hasInvokedProperty('levitation', state);
}

function downStairwayAtHero(state: GameState): Stairway | null {
    const { ux, uy } = state.u;
    let stairs = state.stairs;
    while (stairs && (stairs.sx !== ux || stairs.sy !== uy))
        stairs = stairs.next;
    return stairs && !stairs.up ? stairs : null;
}

// C artifact_has_invprop(obj, LEVITATION) over the whole inventory: the
// artifact confers levitation via #invoke, whether or not it is the source
// currently keeping the hero aloft.
function refreshLevitationArtifactCooldowns(state: GameState): void {
    const turn = state.moves;
    for (const object of state.inventory) {
        if (!object.oartifact) continue;
        if (artifactById(object.oartifact, state)?.invokePower !== 'levitation')
            continue;
        if (object.age < turn) object.age = turn;
        object.age += rnz(100);
    }
}

// C fountain.c:21-32 floating_above().  Stuck in the floor overrides the
// usual wording and always names the surface.
export async function floatingAbove(
    what: string, state: GameState = game, publish: MessagePublisher = plineWithContinuation,
): Promise<void> {
    const hero = state.u;
    if (hero.utrap && (hero.utraptype === TT_INFLOOR
        || hero.utraptype === TT_LAVA)) {
        await publish(`You are trapped in the ${
            surfaceName(hero.ux, hero.uy, state)}.`);
        return;
    }
    await publish(`You are floating high above the ${what}.`);
}

export async function descendFromLevitation(
    state: GameState = game,
    { publish = plineWithContinuation }: { publish?: MessagePublisher } = {},
): Promise<LevitationDescentResult> {
    // The descend command mutates artifact cooldowns and lands the hero
    // through the live float owner.
    requireLiveGame(state);
    // C do.c:1154 HLevitation || ELevitation as a raw bit read, including
    // the mid-drop carried source, independent of the blocked mask.
    if (!hasRawLevitationSource(state))
        return { handled: false, spentTurn: false };

    if (heroHasControlledLevitation(state)) {
        if (hasInvokedProperty('levitation', state))
            refreshLevitationArtifactCooldowns(state);
        const landed = await floatHeroDown(I_SPECIAL | TIMEOUT, W_ARTI,
            state);
        if (landed)
            return { handled: true, spentTurn: true }; /* came down, moved */
        if (!hasRawLevitationSource(state)) {
            await publish('Your latent levitation ceases.');
            return { handled: true, spentTurn: true }; /* effectively moved */
        }
    }

    let stairsDown = false;
    let ladderDown = false;
    const stairway = downStairwayAtHero(state);
    if (stairway) {
        stairsDown = !stairway.isladder;
        ladderDown = !stairsDown;
    }

    const blocked = propertyIsBlocked('levitation', state);
    if (!blocked && heroIsBlind(state)) {
        // Avoid alerting the player to an unknown stair or ladder: only a
        // plain down glyph on screen proves the hero knows what is below.
        // Branch variants use distinct symbols, exactly like the C cmap
        // comparison.
        const glyph = glyphAt(state.u.ux, state.u.uy, state);
        const name = glyph?.kind === 'terrain' ? glyph.terrainName : null;
        if (stairsDown) stairsDown = name === 'staircase down';
        else if (ladderDown) ladderDown = name === 'ladder down';
    }

    if (Is_airlevel(state.u.uz)) {
        await publish(`You are floating in the ${
            surfaceName(state.u.ux, state.u.uy, state)}.`);
    } else if (Is_waterlevel(state.u.uz)) {
        await publish(`You are floating in ${
            isPoolAt(state.u.ux, state.u.uy, state)
                ? 'the water' : 'a bubble of air'}.`);
    } else {
        await floatingAbove(stairsDown ? 'stairs'
            : ladderDown ? 'ladder'
                : surfaceName(state.u.ux, state.u.uy, state),
        state, publish);
    }
    return { handled: true, spentTurn: false }; /* didn't move */
}
