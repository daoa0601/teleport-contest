// Fire traps under the hero.
// C ref: trap.c dofiretrap().

import { heroHasDrainResistance } from './armor.js';
import { ICE, IS_LAVA, IS_POOL, Upolyd } from './const.js';
import { plineWithContinuation, shieldeff } from './display.js';
import { loseExperienceLevel } from './exper.js';
import { game } from './gstate.js';
import { burnAwayHeroSlime } from './hack.js';
import { meltIce } from './ice.js';
import { igniteItems } from './light.js';
import { MONSTER_LEVEL } from './monster_data.js';
import { d, rn2, rnd } from './rng.js';
import { burnHeroArmorByFire } from './trap.js';
import { burnFloorObjectsAt, destroyFireInventory } from './zap.js';

const PM_STRAW_GOLEM = 249;
const PM_PAPER_GOLEM = 250;
const PM_LEATHER_GOLEM = 253;
const PM_WOOD_GOLEM = 254;

function heroIsBlind() {
    return !!(game.blind || (game.u?.blindTurns ?? 0) > 0);
}

function heroResistsFire() {
    return !!(game.u?.fireResistance || game.u?.fire_resistance);
}

function surfaceAtHero() {
    const terrain = game.level?.at?.(game.u.ux, game.u.uy)?.typ;
    if (IS_LAVA(terrain)) return 'lava';
    if (IS_POOL(terrain)) return 'water';
    if (terrain === ICE) return 'ice';
    return 'floor';
}

function loseHeroHitPoints(amount) {
    const hitPoints = Upolyd(game.u) ? 'mh' : 'uhp';
    game.u[hitPoints] = Math.max(
        0, (game.u[hitPoints] ?? 1) - amount,
    );
}

function golemFireDamage(hero) {
    if (hero.umonnum === PM_PAPER_GOLEM) return hero.mhmax;
    if (hero.umonnum === PM_STRAW_GOLEM)
        return Math.trunc(hero.mhmax / 2);
    if (hero.umonnum === PM_WOOD_GOLEM)
        return Math.trunc(hero.mhmax / 4);
    if (hero.umonnum === PM_LEATHER_GOLEM)
        return Math.trunc(hero.mhmax / 8);
    return 0;
}

function reduceMonsterFormMaximumHitPoints(damage) {
    const hero = game.u;
    const formLevel = MONSTER_LEVEL[hero.umonnum] ?? 0;
    if ((hero.mhmax ?? 1) > formLevel) {
        const range = Math.min(hero.mhmax, damage + 1);
        hero.mhmax -= rn2(range);
    }
    hero.mh = Math.min(hero.mh ?? hero.mhmax, hero.mhmax);
}

function reduceHeroMaximumHitPoints(damage) {
    const hero = game.u;
    const oldMaximum = hero.uhpmax ?? 1;
    const minimum = Math.max(hero.ulevel ?? 1, 1);
    if (hero.uhpmax > minimum) {
        const range = Math.min(hero.uhpmax, damage + 1);
        hero.uhpmax -= rn2(range);
    }
    if (hero.uhpmax < minimum) {
        hero.uhpmax = Math.min(oldMaximum, minimum);
        if (!heroHasDrainResistance(game)) loseExperienceLevel(game);
    }
    hero.uhp = Math.min(hero.uhp ?? hero.uhpmax, hero.uhpmax);
}

async function burnHeroAndPossessions(damage, originalDamage) {
    if (!damage) await plineWithContinuation('You are uninjured.');
    else loseHeroHitPoints(damage);

    await burnAwayHeroSlime(game, plineWithContinuation);
    const torsoChecked = await burnHeroArmorByFire(
        game, plineWithContinuation, [], rn2,
    );
    if (torsoChecked || rn2(3) !== 0) {
        await destroyFireInventory(originalDamage);
        await igniteItems(game.inventory, {
            state: game,
            publish: plineWithContinuation,
        });
    }
}

async function burnFloorAndIce() {
    const hero = game.u;
    const blind = heroIsBlind();
    const burned = await burnFloorObjectsAt(hero.ux, hero.uy, {
        state: game,
        giveFeedback: !blind,
    });
    if (burned && blind)
        await plineWithContinuation('You smell paper burning.');
    if (game.level?.at?.(hero.ux, hero.uy)?.typ === ICE)
        await meltIce(hero.ux, hero.uy);
}

export async function triggerHeroFireTrap(trap) {
    const hero = game.u;
    trap.tseen = true;
    const originalDamage = d(2, 4);

    if (hero.uinwater || hero.underwater) {
        await plineWithContinuation(
            `A cascade of steamy bubbles erupts from the ${
                surfaceAtHero()
            }!`,
        );
        if (heroResistsFire())
            await plineWithContinuation('You are uninjured.');
        else loseHeroHitPoints(rnd(3));
        return;
    }

    await plineWithContinuation(
        `A tower of flame erupts from the ${surfaceAtHero()}!`,
    );

    let damage = originalDamage;
    if (heroResistsFire()) {
        await shieldeff(hero.ux, hero.uy);
        damage = rn2(2);
    } else if (Upolyd(hero)) {
        damage = Math.max(damage, golemFireDamage(hero));
        reduceMonsterFormMaximumHitPoints(damage);
    } else {
        damage = d(2, 4);
        reduceHeroMaximumHitPoints(damage);
    }

    await burnHeroAndPossessions(damage, originalDamage);
    await burnFloorAndIce();
}
