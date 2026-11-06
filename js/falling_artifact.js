// Falling and returning weapons have no attacker for artifact_hit().
import { applyArtifactHit } from './artifact.js';
// Port only: artifact_hit() entry for falling and returning weapons, which
// have no attacker (C passes &gy.youmonst to artifact_hit() directly).
export async function hitHeroWithFallingArtifact(object, baseDamage, options) {
    return applyArtifactHit(object, 'hero', baseDamage, options);
}
//# sourceMappingURL=falling_artifact.js.map