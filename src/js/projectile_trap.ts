// Arrows and darts fired at monsters by floor traps.
// C ref: trap.c:trapeffect_arrow_trap() and trapeffect_dart_trap().

import type { Monster } from './monster_types.js';
import type { GameObject } from './object_types.js';
import type { GameState } from './game_state.js';
import type { Trap } from './map_types.js';
import type { MessagePublisher } from './display.js';
import { finishMonsterKilled } from './monster_death.js';
import type { MonsterDeathResult } from './monster_death.js';
import { AD_PHYS } from './monster_attack_types.js';
import { deleteTrap, revealTrap } from './trap_lifecycle.js';
import { ARROW_TRAP, DART_TRAP } from './const.js';
import { placeCreatedObject, stack_object } from './floor_object.js';
import { game, requireGameLevel } from './gstate.js';
import { MONSTER_NAME } from './monster_data.js';
import { findMonsterArmorClass } from './monworn.js';
import { ARROW, DART, OBJECT_NAMES } from './object_data.js';
import { deleteObject } from './object_delete.js';
import { rn2, rnd } from './rng.js';
import { monsterTrapVisibility } from './trap.js';
import { makeTrapMissile } from './trap_missile.js';
import { rollPhysicalWeaponDamage } from './weapon_damage.js';

interface TrapVisibility {
    trap: Trap;
    inSight: boolean;
    seeSquare: boolean;
    finished: boolean;
}

export interface SpentProjectileTrapEvent extends TrapVisibility {
    kind: 'spent-projectile-trap';
}

export interface FlyingTrapProjectileEvent extends TrapVisibility {
    kind: 'projectile-trap';
    missile: GameObject;
    hit: boolean;
    killed: boolean;
    death?: MonsterDeathResult;
}

export type MonsterProjectileTrapEvent = SpentProjectileTrapEvent | FlyingTrapProjectileEvent;

interface FinishTrapOptions {
    publish?: MessagePublisher;
    random?: (limit: number) => number;
    rollOne?: (sides: number) => number;
    describeMonster?: (monster: Monster) => string;
}

function ordinaryMonsterSubject(monster: Monster) {
    if (monster.name) return monster.name;
    return `The ${MONSTER_NAME[monster.mnum] || 'monster'}`;
}

async function placeMissile(missile: GameObject, trap: Trap, state: GameState) {
    if (state === game) placeCreatedObject(missile, trap.tx, trap.ty);
    else {
        missile.ox = trap.tx;
        missile.oy = trap.ty;
        missile.where = 'floor';
        const level = requireGameLevel(state);
        const column = (level.objects[trap.tx] ??= []);
        const pile = (column[trap.ty] ??= []);
        pile.unshift(missile);
    }
    return await stack_object(missile, state);
}

function missileName(missile: GameObject) {
    const name = OBJECT_NAMES[missile.otyp] || (missile.otyp === ARROW ? 'arrow' : 'dart');
    return missile.opoisoned ? `poisoned ${name}` : name;
}

export async function beginMonsterProjectileTrap(
    monster: Monster,
    trap: Trap,
    state: GameState = game,
    { random = rn2, rollOne = rnd } = {},
): Promise<MonsterProjectileTrapEvent> {
    const visibility = monsterTrapVisibility(monster, state);
    if (trap.once && trap.tseen && random(15) === 0) {
        const event: SpentProjectileTrapEvent = {
            kind: 'spent-projectile-trap',
            trap,
            finished: !(visibility.inSight && visibility.seeSquare),
            ...visibility,
        };
        if (event.finished) deleteTrap(trap, state);
        return event;
    }

    trap.once = true;
    const projectileType = trap.ttyp === DART_TRAP ? DART : ARROW;
    const missile = await makeTrapMissile(projectileType, trap);
    if (projectileType === DART && random(6) === 0) missile.opoisoned = 1;
    if (visibility.inSight) revealTrap(trap, state);
    const hit =
        findMonsterArmorClass(monster) + (trap.ttyp === ARROW_TRAP ? 8 : 7) + (missile.spe ?? 0) <=
        rollOne(20);
    return {
        kind: 'projectile-trap',
        trap,
        missile,
        hit,
        killed: false,
        finished: false,
        ...visibility,
    };
}

export function projectileTrapNeedsResume(
    event: { kind: string; finished?: boolean } | null | undefined,
) {
    return (
        event?.kind === 'projectile-trap' ||
        (event?.kind === 'spent-projectile-trap' && !event.finished)
    );
}

export async function finishMonsterProjectileTrap(
    monster: Monster,
    event: MonsterProjectileTrapEvent | null,
    state: GameState = game,
    {
        publish = async () => {},
        random = rn2,
        rollOne = rnd,
        describeMonster = ordinaryMonsterSubject,
    }: FinishTrapOptions = {},
) {
    if (!event || event.finished) return event;
    if (event.kind === 'spent-projectile-trap') {
        const subject = describeMonster(monster);
        await publish(`${subject} triggers a trap but nothing happens.`);
        deleteTrap(event.trap, state);
        event.finished = true;
        return event;
    }
    const name = missileName(event.missile);
    const article = /^[aeiou]/iu.test(name) ? 'an' : 'a';
    if (event.seeSquare) {
        await publish(
            `${describeMonster(monster)} is ${
                event.hit ? 'hit' : 'almost hit'
            } by ${article} ${name}!`,
        );
    }
    if (event.hit) {
        const damage = Math.max(1, rollPhysicalWeaponDamage(event.missile, monster, { rollOne }));
        monster.mhp = Math.max(0, (monster.mhp ?? 1) - damage);
        await deleteObject(event.missile, state);
        if (monster.mhp <= 0) {
            const death = await finishMonsterKilled(monster, state, {
                damageType: AD_PHYS,
                random,
                publish,
            });
            event.death = death;
            event.killed = !death.survived;
            if (death.survived) monster.dead = false;
        }
    } else {
        event.missile = await placeMissile(event.missile, event.trap, state);
    }
    event.finished = true;
    return event;
}
