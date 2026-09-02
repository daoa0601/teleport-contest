// Fire-trap effects on the hero and monsters.
// C refs: trap.c dofiretrap() and trapeffect_fire_trap().

import { heroHasDrainResistance } from './armor.js';
import { ICE, IS_LAVA, IS_POOL, Upolyd } from './const.js';
import { plineWithContinuation, shieldeff } from './display.js';
import { loseExperienceLevel } from './exper.js';
import { game } from './gstate.js';
import { burnAwayHeroSlime } from './hack.js';
import { dist2 } from './hacklib.js';
import { meltIce } from './ice.js';
import { igniteItems } from './light.js';
import {
    MONSTER_LEVEL, monsterIsNonliving, monsterTypeName,
} from './monster_data.js';
import { monsterHasFireResistance } from './monster_resistance.js';
import { d, rn2, rnd } from './rng.js';
import {
    burnArmorByFire, burnHeroArmorByFire, monsterTrapVisibility,
} from './trap.js';
import { surfaceName } from './terrain_name.js';
import {
    burnFloorObjectsAt, destroyFireInventory,
    destroyFireMonsterInventory,
} from './zap.js';

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

function golemFireDamage(form, maximumHitPoints) {
    if (form === PM_PAPER_GOLEM) return maximumHitPoints;
    if (form === PM_STRAW_GOLEM)
        return Math.trunc(maximumHitPoints / 2);
    if (form === PM_WOOD_GOLEM)
        return Math.trunc(maximumHitPoints / 4);
    if (form === PM_LEATHER_GOLEM)
        return Math.trunc(maximumHitPoints / 8);
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

function ordinaryMonsterName(monster) {
    return monster?.name
        || monsterTypeName(monster?.mnum, !!monster?.female);
}

function ordinaryMonsterSubject(monster) {
    return monster?.name || `The ${ordinaryMonsterName(monster)}`;
}

function monsterFireDeathMessage(monster, event, describeMonster) {
    if (!event.seeSquare) return null;
    const verb = monsterIsNonliving(monster.mnum)
        ? 'destroyed' : 'killed';
    return `${describeMonster(monster)} is ${verb}!`;
}

async function finishMonsterFireDeath(
    monster, event, {
        finishDeath, publish, random, describeMonster, noCorpse,
    },
) {
    const death = await finishDeath(monster, {
        deathMessage: monsterFireDeathMessage(
            monster, event, describeMonster,
        ),
        visible: event.seeSquare,
        spotted: event.inSight,
        noCorpse,
        random,
        publish,
    });
    event.death = death;
    if (death.survived) event.lifeSaved = true;
    return !death.survived;
}

export function beginMonsterFireTrap(
    monster, trap, state, { rollDice = d } = {},
) {
    const visibility = monsterTrapVisibility(monster, state);
    return {
        kind: 'fire-trap',
        trap,
        originalDamage: rollDice(2, 4),
        damage: 0,
        itemDamage: 0,
        killed: false,
        finished: false,
        ...visibility,
        visible: visibility.inSight,
    };
}

export async function finishMonsterFireTrap(
    monster, event, state = game, {
        finishDeath,
        publish = plineWithContinuation,
        random = rn2,
        rollOne = rnd,
        monsterName = ordinaryMonsterName,
        describeMonster = ordinaryMonsterSubject,
    } = {},
) {
    if (event.finished) return event;
    const x = event.trap.tx;
    const y = event.trap.ty;
    const surface = surfaceName(x, y, state);
    if (event.inSight) {
        await publish(
            `A tower of flame erupts from the ${surface} under ${
                monsterName(monster)
            }!`,
        );
    } else if (event.seeSquare) {
        await publish(`You see a tower of flame erupt from the ${surface}!`);
    }

    event.resisted = monsterHasFireResistance(monster);
    if (event.resisted) {
        if (event.inSight) {
            await shieldeff(monster.mx, monster.my, state);
            await publish(`${describeMonster(monster)} is uninjured.`);
        }
    } else {
        event.damage = Math.max(
            event.originalDamage,
            golemFireDamage(monster.mnum, monster.mhpmax ?? 1),
        );
        monster.mhp = Math.max(0, (monster.mhp ?? 1) - event.damage);
        let dead = false;
        if (monster.mhp <= 0) {
            dead = await finishMonsterFireDeath(monster, event, {
                finishDeath,
                publish,
                random,
                describeMonster,
                noCorpse: monster.mnum === PM_PAPER_GOLEM,
            });
        }
        if (!dead) {
            event.maximumLoss = random(event.damage + 1);
            monster.mhpmax = Math.max(
                1, (monster.mhpmax ?? monster.mhp) - event.maximumLoss,
            );
            monster.mhp = Math.min(monster.mhp, monster.mhpmax);
        }
    }

    const torsoBurned = await burnArmorByFire(
        monster, state, publish, [], random, {
            visible: event.inSight,
            ownerName: describeMonster(monster),
        },
    );
    event.possessionsBurned = torsoBurned || random(3) !== 0;
    if (event.possessionsBurned) {
        event.itemDamage = await destroyFireMonsterInventory(
            monster, event.originalDamage, {
                carrierName: monsterName(monster),
                publish,
                random,
                rollOne,
                visible: event.inSight,
            },
        );
        await igniteItems(monster.minvent || monster.inventory, {
            carrierName: monsterName(monster),
            state,
            publish,
            random,
            visible: event.inSight,
        });
        if ((monster.mhp ?? 0) > 0 && event.itemDamage > 0) {
            monster.mhp = Math.max(0, monster.mhp - event.itemDamage);
            if (monster.mhp <= 0) {
                await finishMonsterFireDeath(monster, event, {
                    finishDeath,
                    publish,
                    random,
                    describeMonster,
                    noCorpse: monster.mnum === PM_PAPER_GOLEM
                        || monster.mnum === PM_STRAW_GOLEM,
                });
            }
        }
    }

    event.floorObjectsBurned = await burnFloorObjectsAt(x, y, {
        state,
        giveFeedback: event.seeSquare,
        publish,
        random,
        visible: event.seeSquare,
    });
    const heroX = state.u?.ux ?? x;
    const heroY = state.u?.uy ?? y;
    if (event.floorObjectsBurned && !event.seeSquare
        && dist2(x, y, heroX, heroY) <= 9) {
        await publish('You smell smoke.');
    }
    if (state.level?.at?.(x, y)?.typ === ICE)
        await meltIce(x, y);
    if (event.seeSquare && state.level?.traps?.includes(event.trap))
        event.trap.tseen = true;

    event.killed = !!monster.dead || (monster.mhp ?? 0) <= 0;
    event.finished = true;
    return event;
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
        damage = Math.max(
            damage, golemFireDamage(hero.umonnum, hero.mhmax),
        );
        reduceMonsterFormMaximumHitPoints(damage);
    } else {
        damage = d(2, 4);
        reduceHeroMaximumHitPoints(damage);
    }

    await burnHeroAndPossessions(damage, originalDamage);
    await burnFloorAndIce();
}
