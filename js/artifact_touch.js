// The visible hero transaction for touching an artifact.
// C ref: artifact.c touch_artifact().
import { artifactById, resolveHeroArtifactTouch, rollHeroArtifactBlast } from './artifacts.js';
import { exerciseAttribute } from './attrib.js';
import { A_WIS, KILLED_BY } from './const.js';
import { plineWithContinuation } from './display.js';
import { finishHeroDeath } from './end.js';
import { game } from './gstate.js';
import { loseHeroHp } from './hero_damage.js';
import { definiteName, objectCombatName, objectNameIsPlural } from './objnam.js';
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
        const name = definiteName(objectCombatName(object, { state }), state);
        await publish(`You are blasted by ${name}${name.endsWith('s') ? "'" : "'s"} power!`);
        damage = rollHeroArtifactBlast(object, artifact, state);
        // C touch_artifact(): losehp(dmg, "touching <artifact>", KILLED_BY).
        died = await loseHeroHp(damage, `touching ${artifact.name}`, {
            state,
            publish,
            die,
            killerFormat: KILLED_BY,
        });
        if (!died)
            await exerciseAttribute(A_WIS, false, state);
    }
    if (!died && !result.allowed) {
        const name = definiteName(objectCombatName(object, { state }), state);
        const subject = name.charAt(0).toUpperCase() + name.slice(1);
        const plural = objectNameIsPlural(object, state);
        await publish(heroCarries(object, state)
            ? `${subject} ${plural ? 'are' : 'is'} beyond your control!`
            : `${subject} ${plural ? 'evade' : 'evades'} your grasp!`);
    }
    return { ...result, damage, died };
}
//# sourceMappingURL=artifact_touch.js.map