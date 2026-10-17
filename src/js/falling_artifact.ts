// Falling and returning weapons have no attacker for artifact_hit().
import { applyArtifactHit } from './artifact_hit.js';
import type { ArtifactHitResult } from './artifact_hit.js';
import type { MessagePublisher } from './display.js';
import type { PlayingGameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { rn2, rnd } from './rng.js';

interface FallingArtifactOptions {
    state: PlayingGameState;
    publish: MessagePublisher;
    random: typeof rn2;
    rollOne: typeof rnd;
    dieRoll: number;
}

export async function hitHeroWithFallingArtifact(
    object: GameObject, baseDamage: number, options: FallingArtifactOptions,
): Promise<ArtifactHitResult> {
    return applyArtifactHit(object, 'hero', baseDamage, options);
}
