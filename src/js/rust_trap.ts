// Rust traps triggered by monsters.
// C ref: trap.c:trapeffect_rust_trap().

import type { Monster } from './monster_types.js';
import type { GameState } from './game_state.js';
import type { Trap } from './map_types.js';
import type { MessagePublisher } from './display.js';
import { finishMonsterKilled } from './monster_death.js';
import type { MonsterDeathResult } from './monster_death.js';
import { AD_RUST } from './monster_attack_types.js';
import type { MonsterRustTrapEvent as RustTrapEffect } from './trap.js';
import { monsterArmName } from './body_parts.js';
import { plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { wornMonsterLifeSaver } from './mondeath.js';
import { monsterTypeName } from './monster_data.js';
import { possessiveName } from './monster_name.js';
import { OBJECT_NAMES } from './object_data.js';
import { rn2 } from './rng.js';
import { applyMonsterRustTrap, monsterTrapVisibility } from './trap.js';

export interface MonsterRustTrapEvent extends RustTrapEffect {
    trap: Trap;
    inSight: boolean;
    seeSquare: boolean;
    finished: boolean;
    startsToFall?: boolean;
    death?: MonsterDeathResult;
}

interface RustTrapOptions {
    publish?: MessagePublisher;
    random?: (limit: number) => number;
    describeMonster?: (monster: Monster) => string;
}

function ordinaryMonsterSubject(monster: Monster) {
    return monster?.name || `The ${monsterTypeName(monster?.mnum, !!monster?.female)}`;
}

async function presentRustTrap(
    monster: Monster,
    event: MonsterRustTrapEvent,
    describeMonster: (monster: Monster) => string,
    publish: MessagePublisher,
) {
    if (!event.inSight) return;

    const name = describeMonster(monster);
    const lowerName = name.replace(/^The /, 'the ');
    const owner = possessiveName(name);
    const lowerOwner = possessiveName(lowerName);
    const arm = monsterArmName(monster.mnum);
    const hit =
        event.target === 'head'
            ? `A gush of water hits ${lowerName} on the head!`
            : event.target === 'left-arm'
              ? `A gush of water hits ${lowerName}'s left ${arm}!`
              : event.target === 'right-arm'
                ? `A gush of water hits ${lowerName}'s right ${arm}!`
                : `A gush of water hits ${lowerName}!`;
    await publish(hit);

    for (const effect of event.effects) {
        const objectName =
            effect.description ||
            OBJECT_NAMES[effect.object?.otyp] ||
            effect.object?.name ||
            'object';
        if (effect.kind === 'grease-protected') {
            await publish(`${owner} ${objectName} is protected by the layer of grease!`);
        } else if (effect.kind === 'rustproof') {
            await publish(`Somehow, ${lowerOwner} ${objectName} is not affected by the oxidation.`);
        } else if (effect.kind === 'rusted') {
            const adverb =
                effect.erosion === 3 ? ' completely' : effect.erosion > 1 ? ' further' : '';
            await publish(`${owner} ${objectName} rusts${adverb}!`);
        } else if (effect.kind === 'lantern-flickers') {
            await publish(`${owner} ${objectName} crackles and flickers.`);
        } else if (effect.kind === 'extinguished') {
            await publish(`${owner} ${objectName} goes out!`);
        }
    }
    if (event.completelyRusted) {
        const action = event.startsToFall ? 'starts to fall' : 'falls';
        await publish(`${name} ${action} to pieces!`);
    } else if (event.clone) {
        await publish(`${name} multiplies!`);
    }
}

export async function beginMonsterRustTrap(
    monster: Monster,
    trap: Trap,
    state: GameState = game,
    { random = rn2 } = {},
): Promise<MonsterRustTrapEvent> {
    const event: MonsterRustTrapEvent = {
        ...await applyMonsterRustTrap(monster, state, { roll: random }),
        ...monsterTrapVisibility(monster, state),
        trap,
        finished: false,
    };
    if (event.inSight) trap.tseen = true;
    if (event.completelyRusted) {
        event.startsToFall = !!wornMonsterLifeSaver(monster);
        monster.mhp = 0;
    }
    return event;
}

export async function finishMonsterRustTrap(
    monster: Monster,
    event: MonsterRustTrapEvent | null,
    state: GameState = game,
    {
        publish = plineWithContinuation,
        random = rn2,
        describeMonster = ordinaryMonsterSubject,
    }: RustTrapOptions = {},
) {
    if (!event || event.finished) return event;
    await presentRustTrap(monster, event, describeMonster, publish);
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
