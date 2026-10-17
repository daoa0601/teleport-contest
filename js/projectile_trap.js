// Arrows and darts fired at monsters by floor traps.
// C ref: trap.c:trapeffect_arrow_trap() and trapeffect_dart_trap().
import { finishMonsterKilled } from './monster_death.js';
import { AD_PHYS } from './monster_attack_types.js';
import { deleteTrap } from './trap_lifecycle.js';
import { ARROW_TRAP, DART_TRAP } from './const.js';
import { placeCreatedObject, stack_object } from './floor_object.js';
import { game, requireGameLevel } from './gstate.js';
import { findMonsterArmorClass } from './monworn.js';
import { ARROW, DART } from './object_data.js';
import { objectDescription } from './object_description.js';
import { observeObjectForNaming } from './objnam.js';
import { deleteObject } from './object_delete.js';
import { rn2, rnd } from './rng.js';
import { monsterTrapVisibility, seeTrap } from './trap.js';
import { newsym } from './display.js';
import { makeTrapMissile } from './trap_missile.js';
import { rollPhysicalWeaponDamage } from './weapon_damage.js';
import { monsterName } from './monster_name.js';
async function placeMissile(missile, trap, state) {
    if (state === game)
        placeCreatedObject(missile, trap.tx, trap.ty);
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
export async function beginMonsterProjectileTrap(monster, trap, state = game, { random = rn2, rollOne = rnd } = {}) {
    const visibility = monsterTrapVisibility(monster, state);
    if (trap.once && trap.tseen && random(15) === 0) {
        const event = {
            kind: 'spent-projectile-trap',
            trap,
            finished: !(visibility.inSight && visibility.seeSquare),
            ...visibility,
        };
        if (event.finished) {
            deleteTrap(trap, state);
            if (state === game)
                newsym(monster.mx, monster.my);
        }
        return event;
    }
    trap.once = true;
    const projectileType = trap.ttyp === DART_TRAP ? DART : ARROW;
    const missile = await makeTrapMissile(projectileType, trap);
    if (projectileType === DART && random(6) === 0)
        missile.opoisoned = 1;
    if (visibility.inSight)
        seeTrap(trap, state);
    const hit = findMonsterArmorClass(monster) + (trap.ttyp === ARROW_TRAP ? 8 : 7) + (missile.spe ?? 0) <=
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
export function projectileTrapNeedsResume(event) {
    return (event?.kind === 'projectile-trap' ||
        (event?.kind === 'spent-projectile-trap' && !event.finished));
}
export async function finishMonsterProjectileTrap(monster, event, state = game, { publish = async () => { }, random = rn2, rollOne = rnd, describeMonster = target => monsterName(target, { state, capitalized: true }), } = {}) {
    if (!event || event.finished)
        return event;
    if (event.kind === 'spent-projectile-trap') {
        const subject = describeMonster(monster);
        await publish(`${subject} triggers a trap but nothing happens.`);
        deleteTrap(event.trap, state);
        if (state === game)
            newsym(monster.mx, monster.my);
        event.finished = true;
        return event;
    }
    if (event.seeSquare) {
        // C trap.c:thitm() names the missile with doname(), which also
        // marks a seen missile's appearance as known.
        observeObjectForNaming(event.missile, { state });
        await publish(`${describeMonster(monster)} is ${event.hit ? 'hit' : 'almost hit'} by ${objectDescription(event.missile)}!`);
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
            if (death.survived)
                monster.dead = false;
        }
    }
    else {
        event.missile = await placeMissile(event.missile, event.trap, state);
    }
    event.finished = true;
    return event;
}
//# sourceMappingURL=projectile_trap.js.map