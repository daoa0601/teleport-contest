// Iron chains thrown loose when a drawbridge collapses.
// C ref: dbridge.c destroy_drawbridge() and explode.c scatter().

import {
    A_STR, DOOR, D_CLOSED, D_LOCKED, Upolyd, ZAP_POS, isok,
} from './const.js';
import { exerciseAttribute } from './attrib.js';
import { canProjectMonster, newsym, plineWithContinuation } from './display.js';
import { finishHeroDeath } from './end.js';
import { finishHeroMonsterKill } from './hero_monster_death.js';
import {
    mksobj, place_object, remove_object, stack_object,
} from './mklev.js';
import { wakeAttackedMonster } from './monster_anger.js';
import {
    MONSTER_NAME, MONSTER_SIZE, monsterHatesBlessings,
} from './monster_data.js';
import { findMonsterArmorClass } from './monworn.js';
import { IRON_CHAIN, OBJECT_HIT_BONUS } from './object_data.js';
import { rehumanizeHero } from './polyself.js';
import { rn2, rnd } from './rng.js';
import {
    rollPhysicalWeaponDamage, rollPhysicalWeaponDamageAgainstHero,
} from './weapon_damage.js';

const DIRECTIONS = [
    { dx: -1, dy: 0 },
    { dx: -1, dy: -1 },
    { dx: 0, dy: -1 },
    { dx: 1, dy: -1 },
    { dx: 1, dy: 0 },
    { dx: 1, dy: 1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 1 },
];
function monsterAt(x, y, state) {
    return state.level?.monsters?.find(monster =>
        (monster.mhp ?? 1) > 0 && monster.mx === x && monster.my === y,
    ) || null;
}

function openFloorAt(x, y, state) {
    if (!isok(x, y)) return false;
    const location = state.level.at(x, y);
    if (!ZAP_POS(location.typ)) return false;
    return location.typ !== DOOR
        || !(location.doormask & (D_CLOSED | D_LOCKED));
}

function monsterHitBonus(monster, chain) {
    let bonus = (MONSTER_SIZE[monster.mnum] ?? 2) - 2;
    if (monster.msleeping) bonus += 2;
    if (!monster.mcanmove) bonus += 4;
    bonus += (chain.spe ?? 0) + (OBJECT_HIT_BONUS[chain.otyp] ?? 0);
    if (chain.blessed && monsterHatesBlessings(monster))
        bonus += 2;
    return bonus;
}

async function hitMonster(monster, chain, state, finishMonsterKill) {
    const target = MONSTER_NAME[monster.mnum] || 'monster';
    const visible = canProjectMonster(monster, monster.mx, monster.my);
    if (5 + findMonsterArmorClass(monster)
        + monsterHitBonus(monster, chain) < rnd(20)) {
        if (visible)
            await plineWithContinuation(`The iron chain misses the ${target}.`);
        return;
    }

    const damage = rollPhysicalWeaponDamage(chain, monster);
    if (visible)
        await plineWithContinuation(`The iron chain hits the ${target}.`);
    monster.mhp -= damage;
    if (monster.mhp <= 0) {
        await finishMonsterKill(monster, monster.mx, monster.my, {
            showKillMessage: visible,
            weaponHit: false,
        });
    } else {
        await wakeAttackedMonster(monster);
    }
}

async function hitHero(chain, state) {
    const attack = 8 + (chain.spe ?? 0);
    const armorClass = state.u?.uac ?? 10;
    if (armorClass + attack <= rnd(20)) {
        await plineWithContinuation('The iron chain misses you.');
        return;
    }

    await plineWithContinuation('You are hit by an iron chain.');
    let damage = rollPhysicalWeaponDamageAgainstHero(chain, state);
    if (state.u?.halfPhysicalDamage || state.u?.half_physical_damage)
        damage = Math.ceil(damage / 2);
    exerciseAttribute(A_STR, false, state);
    const hitPoints = Upolyd(state.u) ? 'mh' : 'uhp';
    state.u[hitPoints] = Math.max(0, (state.u[hitPoints] ?? 1) - damage);
    if (state.u[hitPoints] > 0) return;
    if (Upolyd(state.u)) {
        rehumanizeHero(state);
        return;
    }
    await finishHeroDeath({ killer: 'iron chain' });
}

async function scatterChain(chain, origin, state, finishMonsterKill) {
    const direction = DIRECTIONS[rn2(DIRECTIONS.length)];
    rnd(1);
    const destination = {
        x: origin.x + direction.dx,
        y: origin.y + direction.dy,
    };
    remove_object(chain);
    if (!openFloorAt(destination.x, destination.y, state)) {
        destination.x = origin.x;
        destination.y = origin.y;
    } else {
        const monster = monsterAt(destination.x, destination.y, state);
        if (monster)
            await hitMonster(monster, chain, state, finishMonsterKill);
        else if (state.u?.ux === destination.x && state.u?.uy === destination.y)
            await hitHero(chain, state);
    }
    place_object(chain, destination.x, destination.y);
    stack_object(chain, state);
    newsym(origin.x, origin.y);
    newsym(destination.x, destination.y);
}

export async function scatterDrawbridgeDebris(
    bridge,
    wall,
    state,
    options = {},
) {
    const finishMonsterKill = options.finishMonsterKill
        || finishHeroMonsterKill;
    for (let remaining = rn2(6); remaining > 0; remaining--) {
        const origin = {
            x: rn2(2) ? bridge.x : wall.x,
            y: rn2(2) ? bridge.y : wall.y,
        };
        const chain = mksobj(IRON_CHAIN, true, false);
        place_object(chain, origin.x, origin.y);
        await scatterChain(chain, origin, state, finishMonsterKill);
    }
}
