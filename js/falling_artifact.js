// Falling and returning weapons have no attacker for artifact_hit().
import { applyArtifactHit } from './artifact.js';
export async function hitHeroWithFallingArtifact(object, baseDamage, options) {
    return applyArtifactHit(object, 'hero', baseDamage, options);
}
//# sourceMappingURL=falling_artifact.js.map