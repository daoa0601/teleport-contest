// Fire-trap effects on the hero and monsters.
// C refs: trap.c dofiretrap() and trapeffect_fire_trap().
import { formatSeenMessage } from './hero_speech.js';
import { requireInitializedHero } from './hero_types.js';
import { finishMonsterKilled, finishMonsterTrapDeath } from './monster_death.js';
import { AD_FIRE, AD_PHYS } from './monster_attack_types.js';
import { isIceAt, isPoolAt } from './terrain_properties.js';
import { heroHasDrainResistance } from './armor.js';
import { heroHasArtifactDefense } from './artifacts.js';
import { M_SEEN_FIRE, Upolyd } from './const.js';
import { plineWithContinuation, shieldeff } from './display.js';
import { loseHeroExperience } from './exper.js';
import { game } from './gstate.js';
import { loseHeroHp } from './hero_damage.js';
import { burnAwayHeroSlime } from './hack.js';
import { dist2 } from './hacklib.js';
import { meltIce } from './ice.js';
import { igniteItems } from './light.js';
import { MONSTER_LEVEL } from './monster_data.js';
import { monsterHasFireResistance } from './monster_resistance.js';
import { monsterName as perceivedMonsterName } from './monster_name.js';
import { monstersForgetHeroResistance, monstersObserveHeroResistance, } from './monster_perception.js';
import { objectName } from './objnam.js';
import { observeObject } from './object_knowledge.js';
import { heroIsBlind } from './senses.js';
import { d, rn2, rnd } from './rng.js';
import { burnArmorByFire, burnHeroArmorByFire, monsterTrapVisibility, seeTrap } from './trap.js';
import { surfaceName } from './terrain_name.js';
import { burnFloorObjectsAt, destroyFireInventory, destroyFireMonsterInventory } from './zap.js';
const PM_STRAW_GOLEM = 249;
const PM_PAPER_GOLEM = 250;
const PM_LEATHER_GOLEM = 253;
const PM_WOOD_GOLEM = 254;
function heroResistsFire() {
    return !!game.u.fireResistance || heroHasArtifactDefense('fire');
}
function golemFireDamage(form, maximumHitPoints) {
    if (form === PM_PAPER_GOLEM)
        return maximumHitPoints;
    if (form === PM_STRAW_GOLEM)
        return Math.trunc(maximumHitPoints / 2);
    if (form === PM_WOOD_GOLEM)
        return Math.trunc(maximumHitPoints / 4);
    if (form === PM_LEATHER_GOLEM)
        return Math.trunc(maximumHitPoints / 8);
    return 0;
}
function reduceMonsterFormMaximumHitPoints(hero, damage) {
    const formLevel = MONSTER_LEVEL[hero.umonnum] ?? 0;
    if ((hero.mhmax ?? 1) > formLevel) {
        const range = Math.min(hero.mhmax, damage + 1);
        hero.mhmax -= rn2(range);
    }
    hero.mh = Math.min(hero.mh ?? hero.mhmax, hero.mhmax);
}
async function reduceHeroMaximumHitPoints(hero, damage, publish) {
    const oldMaximum = hero.uhpmax ?? 1;
    const minimum = Math.max(hero.ulevel ?? 1, 1);
    if (hero.uhpmax > minimum) {
        const range = Math.min(hero.uhpmax, damage + 1);
        hero.uhpmax -= rn2(range);
    }
    if (hero.uhpmax < minimum) {
        hero.uhpmax = Math.min(oldMaximum, minimum);
        if (!heroHasDrainResistance(game) && (await loseHeroExperience(null, { publish })))
            return true;
    }
    hero.uhp = Math.min(hero.uhp ?? hero.uhpmax, hero.uhpmax);
    return false;
}
async function burnHeroAndPossessions(damage, originalDamage, publish) {
    if (!damage)
        await publish('You are uninjured.');
    else if (await loseHeroHp(damage, 'tower of flame', { publish }))
        return { died: true };
    await burnAwayHeroSlime(game, publish);
    const torsoChecked = await burnHeroArmorByFire(game, publish, [], rn2);
    if (torsoChecked || rn2(3) !== 0) {
        const items = await destroyFireInventory(originalDamage, { publish });
        if (items.heroDied)
            return { died: true };
        await igniteItems(game.inventory, {
            state: game,
            publish,
        });
    }
    return { died: false };
}
async function burnFloorAndIce(box, couldSeeFire, publish) {
    const hero = game.u;
    if (!box) {
        const burned = await burnFloorObjectsAt(hero.ux, hero.uy, {
            state: game,
            giveFeedback: couldSeeFire,
            publish,
        });
        if (burned && !couldSeeFire)
            await publish('You smell paper burning.');
    }
    if (isIceAt(hero.ux, hero.uy))
        await meltIce(hero.ux, hero.uy);
}
export function beginMonsterFireTrap(monster, trap, state, { rollDice = d } = {}) {
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
export async function finishMonsterFireTrap(monster, event, state = game, { publish = plineWithContinuation, random = rn2, rollOne = rnd, describeMonster = monster => perceivedMonsterName(monster, { state, capitalized: true }), } = {}) {
    if (event.finished)
        return event;
    const x = event.trap.tx;
    const y = event.trap.ty;
    const surface = surfaceName(x, y, state);
    if (event.inSight) {
        await publish(`A tower of flame erupts from the ${surface} under ${perceivedMonsterName(monster, { state })}!`);
    }
    else if (event.seeSquare) {
        await publish(formatSeenMessage(`a tower of flame erupt from the ${surface}!`, state));
    }
    event.resisted = monsterHasFireResistance(monster);
    if (event.resisted) {
        if (event.inSight) {
            await shieldeff(monster.mx, monster.my, state);
            await publish(`${describeMonster(monster)} is uninjured.`);
        }
    }
    else {
        event.damage = Math.max(event.originalDamage, golemFireDamage(monster.mnum, monster.mhpmax ?? 1));
        monster.mhp = Math.max(0, (monster.mhp ?? 1) - event.damage);
        let dead = false;
        if (monster.mhp <= 0) {
            const death = await finishMonsterTrapDeath(monster, state, {
                publish,
                random,
                damageType: monster.mnum === PM_PAPER_GOLEM ? 'disintegration' : AD_PHYS,
            });
            event.death = death;
            if (death.survived)
                event.lifeSaved = true;
            dead = !death.survived;
            if (death.heroDied)
                return event;
        }
        if (!dead) {
            event.maximumLoss = random(event.damage + 1);
            monster.mhpmax = Math.max(1, (monster.mhpmax ?? monster.mhp) - event.maximumLoss);
            monster.mhp = Math.min(monster.mhp, monster.mhpmax);
        }
    }
    const torsoBurned = await burnArmorByFire(monster, state, publish, [], random, {
        visible: event.inSight,
    });
    event.possessionsBurned = torsoBurned || random(3) !== 0;
    if (event.possessionsBurned) {
        event.itemDamage = await destroyFireMonsterInventory(monster, event.originalDamage, {
            publish,
            random,
            rollOne,
            visible: event.inSight,
        });
        await igniteItems(monster.minvent || monster.inventory, {
            state,
            publish,
            random,
            visible: event.inSight,
        });
        if ((monster.mhp ?? 0) > 0 && event.itemDamage > 0) {
            monster.mhp = Math.max(0, monster.mhp - event.itemDamage);
            if (monster.mhp <= 0) {
                const death = await finishMonsterKilled(monster, state, {
                    publish,
                    random,
                    damageType: AD_FIRE,
                });
                event.death = death;
                if (death.survived)
                    event.lifeSaved = true;
                if (death.heroDied)
                    return event;
            }
        }
    }
    event.floorObjectsBurned = await burnFloorObjectsAt(x, y, {
        state,
        giveFeedback: event.seeSquare,
        publish,
        random,
    });
    const heroX = state.u?.ux ?? x;
    const heroY = state.u?.uy ?? y;
    if (event.floorObjectsBurned && !event.seeSquare && dist2(x, y, heroX, heroY) <= 9) {
        await publish('You smell smoke.');
    }
    if (isIceAt(x, y, state))
        await meltIce(x, y);
    if (event.seeSquare && state.level?.traps?.includes(event.trap))
        seeTrap(event.trap, state);
    event.killed = !!monster.dead || (monster.mhp ?? 0) <= 0;
    event.finished = true;
    return event;
}
export async function triggerHeroFireTrap(box = null, { publish = plineWithContinuation } = {}) {
    const hero = game.u;
    requireInitializedHero(hero);
    const couldSeeFire = !heroIsBlind();
    const originalDamage = d(2, 4);
    if (box && couldSeeFire)
        observeObject(box);
    const source = box ? objectName(box) : surfaceName(hero.ux, hero.uy);
    const underwater = box && box.where !== 'inventory'
        ? isPoolAt(box.ox, box.oy)
        : !!(game.underwater || hero.uinwater);
    if (underwater) {
        await publish(`A cascade of steamy bubbles erupts from the ${source}!`);
        if (heroResistsFire())
            await publish('You are uninjured.');
        else if (await loseHeroHp(rnd(3), 'boiling water', {
            publish,
            deathCause: 'killed by boiling water',
        }))
            return { died: true };
        return { died: false };
    }
    await publish(`A tower of flame ${box ? 'bursts' : 'erupts'} from the ${source}!`);
    let damage = originalDamage;
    if (heroResistsFire()) {
        await shieldeff(hero.ux, hero.uy);
        monstersObserveHeroResistance(M_SEEN_FIRE);
        damage = rn2(2);
    }
    else if (Upolyd(hero)) {
        damage = Math.max(damage, golemFireDamage(hero.umonnum, hero.mhmax));
        reduceMonsterFormMaximumHitPoints(hero, damage);
        monstersForgetHeroResistance(M_SEEN_FIRE);
    }
    else {
        damage = d(2, 4);
        if (await reduceHeroMaximumHitPoints(hero, damage, publish))
            return { died: true };
        monstersForgetHeroResistance(M_SEEN_FIRE);
    }
    const burned = await burnHeroAndPossessions(damage, originalDamage, publish);
    if (burned.died)
        return burned;
    await burnFloorAndIce(box, couldSeeFire, publish);
    return { died: !!game.program_state.gameover };
}
//# sourceMappingURL=fire_trap.js.map