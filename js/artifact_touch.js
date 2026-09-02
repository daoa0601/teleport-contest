// The visible hero transaction for touching an artifact.
// C ref: artifact.c touch_artifact().

import {
    applyHeroArtifactBlast, artifactById, resolveHeroArtifactTouch,
} from './artifacts.js';
import { A_WIS } from './const.js';
import { plineWithContinuation } from './display.js';
import { finishHeroDeath } from './end.js';
import { game } from './gstate.js';
import { rn2 } from './rng.js';

function heroCarries(object) {
    return object?.where === 'inventory'
        || (game.inventory || []).includes(object);
}

export async function touchArtifactByHero(
    object, artifact = artifactById(object?.oartifact),
) {
    const result = resolveHeroArtifactTouch(object, artifact);
    if (!artifact || !object?.oartifact) return { ...result, died: false };

    let died = false;
    let damage = 0;
    if (result.blasted) {
        await plineWithContinuation(
            `You are blasted by ${artifact.name}'s power!`,
        );
        damage = applyHeroArtifactBlast(object, artifact);
        if ((game.u?.uhp ?? 1) <= 0) {
            died = await finishHeroDeath({
                killer: `touching ${artifact.name}`,
            });
        }
        if (!died) {
            if (!Array.isArray(game.u._exercise))
                game.u._exercise = Array(6).fill(0);
            game.u._exercise[A_WIS] -= rn2(2);
        }
    }

    if (!died && !result.allowed) {
        await plineWithContinuation(heroCarries(object)
            ? `${artifact.name} is beyond your control!`
            : `${artifact.name} evades your grasp!`);
    }
    return { ...result, damage, died };
}
