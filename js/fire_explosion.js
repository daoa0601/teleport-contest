// Fire damage from a one-square-radius explosion.
// C ref: explode.c explode() with AD_FIRE.

import { exerciseAttribute } from './attrib.js';
import { A_STR, LOST_EXPLODING, Upolyd } from './const.js';
import {
    canProjectMonster, plineWithContinuation, shieldeff,
} from './display.js';
import { finishHeroDeath } from './end.js';
import { game } from './gstate.js';
import { finishHeroMonsterKill } from './hero_monster_death.js';
import { endObjectBurn, igniteItems } from './light.js';
import { wakeMonstersNear } from './monster_wake.js';
import { wakeAttackedMonster } from './monster_anger.js';
import { MONSTER_NAME } from './monster_data.js';
import {
    monsterHasColdResistance, monsterHasFireResistance,
} from './monster_resistance.js';
import { rehumanizeHero } from './polyself.js';
import { burnArmorByFire, burnHeroArmorByFire } from './trap.js';
import { d, rn2, rnd } from './rng.js';
import { cansee } from './vision.js';
import { clearHeroSliming } from './slime.js';

const PM_STRAW_GOLEM = 249;
const PM_PAPER_GOLEM = 250;

function insideExplosion(targetX, targetY, x, y) {
    return Math.abs(targetX - x) <= 1 && Math.abs(targetY - y) <= 1;
}

async function elementalDamageFunctions() {
    const zap = await import('./zap.js');
    return {
        applyFloor: zap.applyFireToFloorAt,
        damageHeroInventory: zap.destroyFireInventory,
        damageMonsterInventory: zap.destroyFireMonsterInventory,
    };
}

// explode_oil() extinguishes the potion before the blast so a fatal explosion
// cannot leave an active light behind in death or bones state.
export async function explodeLitOilPotion(potion, x, y, {
    state = game,
    heroCaused = true,
    publish = plineWithContinuation,
    random = rn2,
    rollDice = d,
    finishMonsterKill,
} = {}) {
    if (!potion?.lamplit)
        throw new TypeError('burning oil explosion requires a lit potion');
    const diluted = !!potion.odiluted;
    if (!endObjectBurn(potion, state, state.moves ?? 0))
        throw new Error('lit potion of oil has no active burn timer');

    potion.how_lost = LOST_EXPLODING;
    const damage = rollDice(diluted ? 3 : 4, 4);
    await createFireExplosion(x, y, damage, {
        state,
        name: 'burning oil',
        heroCaused,
        publish,
        random,
        finishMonsterKill,
    });
    return damage;
}

export async function createFireExplosion(x, y, damage, {
    state = game,
    name = 'fireball',
    heroCaused = true,
    publish = plineWithContinuation,
    random = rn2,
    roll = rnd,
    finishMonsterKill = finishHeroMonsterKill,
    applyFloor = null,
    damageHeroInventory = null,
    damageMonsterInventory = null,
    burnMonsterArmor = burnArmorByFire,
    burnHeroArmor = burnHeroArmorByFire,
    ignite = igniteItems,
} = {}) {
    if (!applyFloor || !damageHeroInventory || !damageMonsterInventory) {
        const elemental = await elementalDamageFunctions();
        applyFloor ||= elemental.applyFloor;
        damageHeroInventory ||= elemental.damageHeroInventory;
        damageMonsterInventory ||= elemental.damageMonsterInventory;
    }

    const visible = Array.from({ length: 3 }, (_, dx) => dx - 1)
        .some(dx => Array.from({ length: 3 }, (_, dy) => dy - 1)
            .some(dy => cansee(x + dx, y + dy)));
    if (visible) await publish('Boom!');
    else if (!state.u?.deaf && !state.deaf)
        await publish('You hear a blast.');

    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            await applyFloor(x + dx, y + dy, state);
        }
    }

    for (const monster of [...(state.level?.monsters || [])]) {
        if ((monster.mhp ?? 1) <= 0
            || !insideExplosion(monster.mx, monster.my, x, y)) continue;
        const seen = canProjectMonster(monster, monster.mx, monster.my);
        const monsterName = MONSTER_NAME[monster.mnum] || 'monster';
        if (seen)
            await publish(`The ${monsterName} is caught in the ${name}!`);

        const itemDamage = await damageMonsterInventory(monster, damage, {
            carrierName: monsterName,
            publish,
            random,
            rollOne: roll,
            visible: seen,
        });
        await burnMonsterArmor(monster, state, seen ? publish : null, [], random);
        await ignite(monster.minvent || monster.inventory || [], {
            carrierName: monsterName,
            state,
            publish,
            random,
            visible: seen,
        });

        let directDamage = damage;
        if (monsterHasFireResistance(monster)) {
            directDamage = 0;
            await shieldeff(monster.mx, monster.my, state);
        } else if (monsterHasColdResistance(monster)) {
            directDamage *= 2;
        }
        monster.mhp = Math.max(
            0, (monster.mhp ?? 1) - directDamage - itemDamage,
        );
        if (monster.mhp <= 0) {
            await finishMonsterKill(monster, monster.mx, monster.my, {
                noCorpse: [PM_STRAW_GOLEM, PM_PAPER_GOLEM]
                    .includes(monster.mnum),
            });
        } else if (heroCaused) {
            await wakeAttackedMonster(monster);
        }
    }

    const hero = state.u;
    if (insideExplosion(hero.ux, hero.uy, x, y)) {
        await publish(`You are caught in the ${name}!`);
        if (clearHeroSliming(state)) {
            await publish('The slime that covers you is burned away!');
        }
        await burnHeroArmor(state, publish, [], random);
        await ignite(state.inventory || [], {
            state, publish, random,
        });
        await damageHeroInventory(damage, {
            state, publish, random, rollOne: roll,
        });

        const fireResistant = !!(hero.fireResistance
            || hero.fire_resistance);
        if (fireResistant) await shieldeff(hero.ux, hero.uy, state);
        const hitPoints = Upolyd(hero) ? 'mh' : 'uhp';
        if (!fireResistant)
            hero[hitPoints] = Math.max(0, (hero[hitPoints] ?? 1) - damage);
        if (hero[hitPoints] <= 0) {
            if (Upolyd(hero)) rehumanizeHero(state);
            else await finishHeroDeath({ killer: name });
        }
        exerciseAttribute(A_STR, false, state);
    }

    wakeMonstersNear(x, y, Math.max(50, damage * damage), state);
}
