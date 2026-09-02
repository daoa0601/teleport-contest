// Arrows and darts fired at monsters by floor traps.
// C ref: trap.c:trapeffect_arrow_trap() and trapeffect_dart_trap().

import { ARROW_TRAP, DART_TRAP } from './const.js';
import { game } from './gstate.js';
import { place_object, stack_object } from './mklev.js';
import { MONSTER_NAME } from './monster_data.js';
import { findMonsterArmorClass } from './monworn.js';
import { ARROW, DART, OBJECT_NAMES } from './object_data.js';
import { deleteObject } from './object_delete.js';
import { rn2, rnd } from './rng.js';
import { monsterTrapVisibility } from './trap.js';
import { makeTrapMissile } from './trap_missile.js';
import { rollPhysicalWeaponDamage } from './weapon_damage.js';

function ordinaryMonsterSubject(monster) {
    if (monster.name) return monster.name;
    return `The ${MONSTER_NAME[monster.mnum] || 'monster'}`;
}

function removeTrap(trap, state) {
    const index = state.level?.traps?.indexOf(trap) ?? -1;
    if (index >= 0) state.level.traps.splice(index, 1);
}

function placeMissile(missile, trap, state) {
    if (state === game) place_object(missile, trap.tx, trap.ty);
    else {
        missile.ox = trap.tx;
        missile.oy = trap.ty;
        missile.where = 'floor';
        if (!state.level.objects[trap.tx]) state.level.objects[trap.tx] = [];
        if (!state.level.objects[trap.tx][trap.ty])
            state.level.objects[trap.tx][trap.ty] = [];
        state.level.objects[trap.tx][trap.ty].unshift(missile);
    }
    return stack_object(missile, state);
}

function missileName(missile) {
    const name = OBJECT_NAMES[missile.otyp]
        || (missile.otyp === ARROW ? 'arrow' : 'dart');
    return missile.opoisoned ? `poisoned ${name}` : name;
}

export function beginMonsterProjectileTrap(
    monster,
    trap,
    state = game,
    { random = rn2, rollOne = rnd } = {},
) {
    const visibility = monsterTrapVisibility(monster, state);
    if (trap.once && trap.tseen && random(15) === 0) {
        const event = {
            kind: 'spent-projectile-trap',
            trap,
            finished: !(visibility.inSight && visibility.seeSquare),
            ...visibility,
        };
        if (event.finished) removeTrap(trap, state);
        return event;
    }

    trap.once = true;
    const projectileType = trap.ttyp === DART_TRAP ? DART : ARROW;
    const missile = makeTrapMissile(projectileType, trap);
    if (projectileType === DART && random(6) === 0)
        missile.opoisoned = 1;
    if (visibility.inSight) trap.tseen = true;
    const hit = findMonsterArmorClass(monster)
        + (trap.ttyp === ARROW_TRAP ? 8 : 7)
        + (missile.spe ?? 0) <= rollOne(20);
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

export function projectileTrapNeedsResume(event) {
    return event?.kind === 'projectile-trap'
        || (event?.kind === 'spent-projectile-trap' && !event.finished);
}

export async function finishMonsterProjectileTrap(
    monster,
    event,
    state = game,
    {
        finishDeath,
        publish = async () => {},
        random = rn2,
        rollOne = rnd,
        describeMonster = ordinaryMonsterSubject,
    } = {},
) {
    if (!event || event.finished) return event;
    if (event.kind === 'spent-projectile-trap') {
        const subject = describeMonster(monster);
        await publish(`${subject} triggers a trap but nothing happens.`);
        removeTrap(event.trap, state);
        event.finished = true;
        return event;
    }
    if (typeof finishDeath !== 'function')
        throw new TypeError(
            'projectile trap requires the monster death handler',
        );

    const name = missileName(event.missile);
    const article = /^[aeiou]/iu.test(name) ? 'an' : 'a';
    if (event.seeSquare) {
        await publish(`${describeMonster(monster)} is ${
            event.hit ? 'hit' : 'almost hit'
        } by ${article} ${name}!`);
    }
    if (event.hit) {
        const damage = Math.max(1, rollPhysicalWeaponDamage(
            event.missile, monster, { rollOne },
        ));
        monster.mhp = Math.max(0, (monster.mhp ?? 1) - damage);
        deleteObject(event.missile, state);
        if (monster.mhp <= 0) {
            const subject = describeMonster(monster);
            const death = await finishDeath(monster, {
                deathMessage: event.seeSquare
                    ? `${subject} is killed!` : null,
                visible: event.seeSquare,
                spotted: event.inSight,
                random,
                publish,
            });
            event.death = death;
            event.killed = !death.survived;
            if (death.survived) monster.dead = false;
        }
    } else {
        event.missile = placeMissile(event.missile, event.trap, state);
    }
    event.finished = true;
    return event;
}
