// Rust traps triggered by monsters.
// C ref: trap.c:trapeffect_rust_trap().
import { finishMonsterKilled } from './monster_death.js';
import { AD_RUST } from './monster_attack_types.js';
import { monsterArmName } from './body_parts.js';
import { plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { wornMonsterLifeSaver } from './mondeath.js';
import { monsterName, possessiveName } from './monster_name.js';
import { OBJECT_NAMES } from './object_data.js';
import { rn2 } from './rng.js';
import { applyMonsterRustTrap, monsterTrapVisibility, seeTrap } from './trap.js';
async function presentRustTrap(monster, event, state, publish) {
    if (!event.inSight)
        return;
    const name = monsterName(monster, { state });
    const arm = monsterArmName(monster.mnum);
    const hit = event.target === 'head'
        ? `A gush of water hits ${name} on the head!`
        : event.target === 'left-arm'
            ? `A gush of water hits ${name}'s left ${arm}!`
            : event.target === 'right-arm'
                ? `A gush of water hits ${name}'s right ${arm}!`
                : `A gush of water hits ${name}!`;
    await publish(hit);
    for (const effect of event.effects) {
        const objectName = effect.description ||
            OBJECT_NAMES[effect.object?.otyp] ||
            effect.object?.name ||
            'object';
        const owner = possessiveName(monsterName(monster, {
            state, capitalized: effect.kind !== 'rustproof',
        }));
        if (effect.kind === 'rustproof') {
            await publish(`Somehow, ${owner} ${objectName} is not affected by the oxidation.`);
        }
        else if (effect.kind === 'rusted') {
            const adverb = effect.erosion === 3 ? ' completely' : effect.erosion > 1 ? ' further' : '';
            await publish(`${owner} ${objectName} rusts${adverb}!`);
        }
        else if (effect.kind === 'lantern-flickers') {
            await publish(`${owner} ${objectName} crackles and flickers.`);
        }
        else if (effect.kind === 'extinguished') {
            await publish(`${owner} ${objectName} goes out!`);
        }
    }
    if (event.completelyRusted) {
        const action = event.startsToFall ? 'starts to fall' : 'falls';
        await publish(`${monsterName(monster, { state, capitalized: true })} ${action} to pieces!`);
    }
    else if (event.clone) {
        await publish(`${monsterName(monster, { state, capitalized: true })} multiplies!`);
    }
}
export async function beginMonsterRustTrap(monster, trap, state = game, { random = rn2 } = {}) {
    const event = {
        ...await applyMonsterRustTrap(monster, state, { roll: random }),
        ...monsterTrapVisibility(monster, state),
        trap,
        finished: false,
    };
    // C trapeffect_rust_trap(): seetrap() redraws the square, showing the
    // monster on its new spot before the gush message.
    if (event.inSight)
        seeTrap(trap, state);
    if (event.completelyRusted) {
        event.startsToFall = !!wornMonsterLifeSaver(monster);
        monster.mhp = 0;
    }
    return event;
}
export async function finishMonsterRustTrap(monster, event, state = game, { publish = plineWithContinuation, random = rn2, } = {}) {
    if (!event || event.finished)
        return event;
    await presentRustTrap(monster, event, state, publish);
    if (event.completelyRusted) {
        const death = await finishMonsterKilled(monster, state, {
            damageType: AD_RUST,
            cause: null,
            random,
            publish,
        });
        event.death = death;
        event.killed = !death.survived;
    }
    event.finished = true;
    return event;
}
//# sourceMappingURL=rust_trap.js.map