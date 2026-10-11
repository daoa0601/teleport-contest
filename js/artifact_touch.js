// The visible hero transaction for touching an artifact.
// C ref: artifact.c touch_artifact().
import { artifactById, resolveHeroArtifactTouch, rollHeroArtifactBlast } from './artifacts.js';
import { exerciseAttribute } from './attrib.js';
import { A_WIS } from './const.js';
import { plineWithContinuation } from './display.js';
import { finishHeroDeath } from './end.js';
import { game } from './gstate.js';
import { loseHeroHp } from './hero_damage.js';
function heroCarries(object, state) {
    return object?.where === 'inventory' || (state.inventory || []).includes(object);
}
export async function touchArtifactByHero(object, artifact = artifactById(object?.oartifact), { state = game, publish = plineWithContinuation, die = finishHeroDeath, } = {}) {
    const result = resolveHeroArtifactTouch(object, artifact, state);
    if (!artifact || !object?.oartifact)
        return { ...result, died: false };
    let died = false;
    let damage = 0;
    if (result.blasted) {
        await publish(`You are blasted by ${artifact.name}'s power!`);
        damage = rollHeroArtifactBlast(object, artifact, state);
        died = await loseHeroHp(damage, `touching ${artifact.name}`, {
            state,
            publish,
            die,
        });
        if (!died)
            await exerciseAttribute(A_WIS, false, state);
    }
    if (!died && !result.allowed) {
        await publish(heroCarries(object, state)
            ? `${artifact.name} is beyond your control!`
            : `${artifact.name} evades your grasp!`);
    }
    return { ...result, damage, died };
}
//# sourceMappingURL=artifact_touch.js.map