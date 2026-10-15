// #sit and the immediate consequences of sitting down.
// C ref: sit.c dosit() and lay_an_egg().

import {
    A_STR, A_WIS, ALTAR, DRAWBRIDGE_DOWN, FOUNTAIN, GRAVE, ICE,
    IS_LAVA, IS_POOL, Is_waterlevel, is_hole, is_pit, LADDER, SINK, SPIKED_PIT, STAIRS, THRONE,
    TT_BEARTRAP, TT_BURIEDBALL, TT_INFLOOR, TT_LAVA, TT_PIT, TT_WEB,
} from './const.js';
import { exerciseAttribute } from './attrib.js';
import { displayLiquidName, plineWithContinuation as pline } from './display.js';
import { heroFootName } from './body_parts.js';
import { game, requireInitializedGame } from './gstate.js';
import type { GameObject } from './object_types.js';
import type { Trap } from './map_types.js';
import type { HeroTrapOptions } from './hero_traps.js';
import type { ThroneOptions } from './throne.js';
import { spendHeroNutrition } from './hunger.js';
import { heroCanReachFloor } from './floor_reach.js';
import { burnAwayHeroSlime } from './hack.js';
import { stack_object } from './floor_object.js';
import { dropObjectAtHero } from './object_drop.js';
import { useUpFloorObject } from './floor_consumption.js';
import { heroIsDeaf, heroIsHallucinating } from './senses.js';
import {
    mksobj, set_corpsenm,
} from './mklev.js';
import {
    MONSTER_FLAGS1,
    MONSTER_SYMBOL,
} from './monster_data.js';
import {
    CHEST, CORPSE, CREAM_PIE, EGG, LARGE_BOX, OBJECT_MATERIAL,
    OBJECT_NUTRITION, TOWEL, WATER_WALKING_BOOTS,
} from './object_data.js';
import { observeObject } from './object_knowledge.js';
import { objectCombatName, definiteName } from './objnam.js';
import { monsterName, monsterPossessive } from './monster_name.js';
import { surfaceName } from './terrain_name.js';
import { heroGoldAmount } from './hero_gold.js';
import {
    heroFormFlags, heroFormHidesWithoutCover,
    heroMonsterForm,
} from './polyself.js';
import { heroFormSticks } from './hero_species.js';
import { altarWrath } from './pray.js';
import { d, rnd, rn2 } from './rng.js';
import { waterDamageObject } from './trap.js';
import { objectWeight } from './weight.js';
import { throneSitEffect } from './throne.js';
import { splitSittingGremlin } from './fountain.js';
import { triggerHeroTrap } from './hero_traps.js';
import { loseHeroHp } from './hero_damage.js';

const COIN_CLASS = 12;
const CLOTH = 6;
const M1_SWIM = 0x00000002;
const M1_AMORPHOUS = 0x00000004;
const M1_HUMANOID = 0x00020000;
const M1_SLITHY = 0x00080000;
const M1_OVIPAROUS = 0x00400000;
const S_DRAGON = 30;
const S_EEL = 57;
const PM_QUEEN_BEE = 5;
const PM_GREMLIN = 40;
const PM_GARGOYLE = 41;
const PM_WINGED_GARGOYLE = 42;
const PM_TRAPPER = 99;
const PM_FIRE_VORTEX = 111;
const PM_FLAMING_SPHERE = 30;
const PM_FIRE_ELEMENTAL = 155;
const PM_GIANT_EEL = 319;
const PM_ELECTRIC_EEL = 320;
const PM_SALAMANDER = 329;

function formIsHumanoid() {
    return heroMonsterForm(game) == null
        || !!(heroFormFlags(game) & M1_HUMANOID);
}

function objectQuantity(object: GameObject): number {
    return object?.quan ?? object?.quantity ?? 1;
}

function waterEggLayer() {
    const form = heroMonsterForm(game);
    return form != null
        && (heroFormFlags(game) & (M1_OVIPAROUS | M1_SWIM))
            === (M1_OVIPAROUS | M1_SWIM)
        && MONSTER_SYMBOL[form] === S_EEL;
}

function eggTypeFromParent(parent: number): number {
    if (rn2(77) === 0) return parent;
    if (parent === PM_QUEEN_BEE) return 1;
    if (parent === PM_WINGED_GARGOYLE) return PM_GARGOYLE;
    return parent;
}

async function layEgg(): Promise<boolean> {
    const form = heroMonsterForm(game);
    if (form === null) throw new Error('Laying an egg requires an egg-laying monster form.');
    if (game.flags?.female !== true) {
        await pline(`${heroIsHallucinating()
            ? 'You may think you are a platypus, but a male still'
            : 'Males'} can't lay eggs!`);
        return false;
    }
    const nutrition = OBJECT_NUTRITION[EGG] ?? 0;
    if ((game.u?.uhunger ?? 0) < nutrition) {
        await pline("You don't have enough energy to lay an egg.");
        return false;
    }
    if (waterEggLayer()) {
        if (!(game.underwater || game.u?.uinwater
            || Is_waterlevel(game.u.uz))) {
            await pline('A splash tetra you are not.');
            return false;
        }
        if (form === PM_GIANT_EEL || form === PM_ELECTRIC_EEL) {
            await pline('You yearn for the Sargasso Sea.');
            return false;
        }
    }

    const egg = await mksobj(EGG, false, false);
    egg.spe = 1;
    egg.quan = egg.quantity = 1;
    set_corpsenm(egg, eggTypeFromParent(form));
    egg.known = true;
    egg.owt = objectWeight(egg);
    observeObject(egg);
    await pline(`You ${waterEggLayer() ? 'spawn' : 'lay'} an egg.`);
    await dropObjectAtHero(egg);
    if (egg.where === 'floor') await stack_object(egg);
    await spendHeroNutrition(nutrition);
    return !game.program_state.gameover;
}

async function sitOnObject(object: GameObject): Promise<void> {
    if (MONSTER_SYMBOL[heroMonsterForm(game) ?? -1] === S_DRAGON
        && object.oclass === COIN_CLASS) {
        const wealth = objectQuantity(object) + heroGoldAmount(game);
        const meager = wealth < (game.u?.ulevel ?? 1) * 1000 ? 'meager ' : '';
        await pline(`You coil up around your ${meager}hoard.`);
        return;
    }
    if (object.otyp === TOWEL) {
        await pline("It's probably not a good time for a picnic...");
        return;
    }

    const name = definiteName(objectCombatName(object, { includeCorpseSpecies: false }));
    await pline(heroFormFlags(game) & M1_SLITHY
        ? `You coil up around ${name}.`
        : `You sit on ${name}.`);
    if (object.otyp === CORPSE
        && (MONSTER_FLAGS1[object.corpsenm ?? -1] ?? 0) & M1_AMORPHOUS) {
        await pline("It's squishy...");
    } else if (object.otyp === CREAM_PIE) {
        if (!heroIsDeaf()) await pline('Squelch!');
        await useUpFloorObject(object, object.quan);
    } else if (object.otyp !== LARGE_BOX && object.otyp !== CHEST
        && OBJECT_MATERIAL[object.otyp] !== CLOTH) {
        await pline("It's not very comfortable...");
    }
}

// Returns true when the hero died.
async function sitWhileTrapped(trap: Trap | null): Promise<boolean> {
    const game = requireInitializedGame();
    const u = game.u;
    if (u.utrap === undefined) throw new Error('Sitting while trapped requires an active trap duration.');
    await exerciseAttribute(A_WIS, false);
    if (u.utraptype === TT_BEARTRAP) {
        await pline(`You can't sit down with your ${heroFootName()} in the bear trap.`);
        u.utrap++;
    } else if (u.utraptype === TT_PIT) {
        if (trap?.ttyp === SPIKED_PIT) {
            await pline('You sit down on a spike.  Ouch!');
            const damage = u.halfPhysicalDamage
                ? rn2(2) : 1;
            if (await loseHeroHp(damage, 'sitting on an iron spike',
                { deathCause: 'killed by sitting on an iron spike' })) return true;
            await exerciseAttribute(A_STR, false);
        } else {
            await pline('You sit down in the pit.');
        }
        u.utrap += rn2(5);
    } else if (u.utraptype === TT_WEB) {
        await pline('You sit in the spider web and get entangled further!');
        u.utrap += 5 + rn2(10);
    } else if (u.utraptype === TT_LAVA) {
        await pline(`You sit in the ${displayLiquidName('lava')}!`);
        await burnAwayHeroSlime(game, pline);
        u.utrap += rnd(4);
        if (await loseHeroHp(d(2, 10), 'sitting in lava',
            { deathCause: 'killed by sitting in lava' })) return true;
    } else if (u.utraptype === TT_INFLOOR
        || u.utraptype === TT_BURIEDBALL) {
        await pline("You can't maneuver to sit!");
        u.utrap++;
    }
    return false;
}

async function sitInWater() {
    await pline(`You sit in the ${displayLiquidName('water')}.`);
    if (heroMonsterForm(game) === PM_GREMLIN) {
        await splitSittingGremlin();
        return;
    }

    const armor = game.uarm || game.u?.uarm;
    const boots = game.uarmf || game.u?.uarmf;
    if (rn2(10) === 0 && armor)
        await waterDamageObject(armor, [], game,
            { force: true, description: 'armor', publish: pline });
    if (rn2(10) === 0 && boots && boots.otyp !== WATER_WALKING_BOOTS) {
        // sit.c passes uarm here too; preserve that behavior from the pinned
        // source rather than silently changing which item gets wet.
        await waterDamageObject(armor, [], game,
            { force: true, description: 'armor', publish: pline });
    }
}

function formLikesLava() {
    return [
        PM_FIRE_VORTEX, PM_FLAMING_SPHERE, PM_FIRE_ELEMENTAL, PM_SALAMANDER,
    ].includes(heroMonsterForm(game) ?? -1);
}

export async function dosit({
    finishTeleport = null,
    gotoLevel = null,
    chooseTeleportDestination = null,
}: Pick<HeroTrapOptions, 'finishTeleport' | 'gotoLevel'> & ThroneOptions = {}): Promise<void> {
    const game = requireInitializedGame();
    const u = game.u;
    const x = u?.ux;
    const y = u?.uy;
    const location = game.level.requireAt(x, y);
    const typ = location.typ;
    const trap = game.level?.traps?.find(candidate =>
        candidate.tx === x && candidate.ty === y) || null;

    if (u?.usteed) {
        await pline(`You are already sitting on ${monsterName(u.usteed)}.`);
        game.context.move = 0;
        return;
    }
    if (u?.uundetected && heroFormHidesWithoutCover(game)
        && heroMonsterForm(game) !== PM_TRAPPER) u.uundetected = 0;

    if (!heroCanReachFloor(game)) {
        if (u?.uswallow) await pline('There are no seats in here!');
        else if (u?.levitating || game.levitating)
            await pline('You tumble in place.');
        else await pline('You are sitting on air.');
        game.context.move = 0;
        return;
    }
    if (u?.ustuck && !heroFormSticks(game)) {
        const holder = u.ustuck;
        const humanoid = (MONSTER_FLAGS1[holder.mnum] ?? 0) & M1_HUMANOID;
        const subject = monsterName(holder, { capitalized: true });
        await pline(humanoid
            ? `${subject} won't offer ${monsterPossessive(holder)} lap.`
            : `${subject} has no lap.`);
        game.context.move = 0;
        return;
    }

    const onPool = IS_POOL(typ);
    if ((onPool && !(game.underwater || u?.uinwater))
        || (heroMonsterForm(game) === PM_GREMLIN
            && (typ === FOUNTAIN || onPool))) {
        await sitInWater();
        game.context.move = 1;
        return;
    }

    const object = game.level?.objects?.[x]?.[y]?.[0];
    const atPitEdge = trap?.tseen && (is_hole(trap.ttyp)
        || is_pit(trap.ttyp) && !(u.utrap && u.utraptype === TT_PIT));
    if (object && !atPitEdge) {
        await sitOnObject(object);
    } else if (trap || (u?.utrap && (u.utraptype ?? 0) >= TT_LAVA)) {
        if (u?.utrap) {
            if (await sitWhileTrapped(trap)) return;
        } else {
            await pline(`You ${u?.flying || game.flying ? 'land' : 'sit down'}.`);
            const result = await triggerHeroTrap(trap, {
                finishTeleport,
                gotoLevel,
                viaSitting: true,
            });
            if (result.died) return;
        }
    } else if ((game.underwater || u?.uinwater
        || Is_waterlevel(game.u.uz)) && !waterEggLayer()) {
        await pline(Is_waterlevel(game.u.uz)
            ? 'There are no cushions floating nearby.'
            : 'You sit down on the muddy bottom.');
    } else if (onPool && !waterEggLayer()) {
        await sitInWater();
    } else if (typ === SINK) {
        await pline('You sit on the sink.');
        await pline(`Your ${formIsHumanoid() ? 'rump' : 'underside'} gets wet.`);
    } else if (typ === ALTAR) {
        await pline('You sit on the altar.');
        await altarWrath(x, y);
    } else if (typ === GRAVE) {
        await pline('You sit on the grave.');
    } else if (typ === STAIRS) {
        await pline('You sit on the stairs.');
    } else if (typ === LADDER) {
        await pline('You sit on the ladder.');
    } else if (IS_LAVA(typ)) {
        await pline(`You sit on the ${displayLiquidName('lava')}.`);
        await burnAwayHeroSlime(game, pline);
        if (formLikesLava()) {
            await pline(`The ${displayLiquidName('lava')} feels warm.`);
        } else {
            await pline(`The ${displayLiquidName('lava')} burns you!`);
            const dice = u?.fireResistance ? 2 : 10;
            if (await loseHeroHp(d(dice, 10), 'sitting on lava',
                { deathCause: 'killed by sitting on lava' })) return;
        }
    } else if (typ === ICE) {
        await pline('You sit on the ice.');
        if (!u?.coldResistance)
            await pline('The ice feels cold.');
    } else if (typ === DRAWBRIDGE_DOWN) {
        await pline('You sit on the drawbridge.');
    } else if (typ === THRONE) {
        await pline('You sit on the throne.');
        await throneSitEffect({ gotoLevel, chooseTeleportDestination });
    } else if (heroFormFlags(game) & M1_OVIPAROUS) {
        if (!await layEgg()) {
            game.context.move = 0;
            return;
        }
    } else {
        await pline(`Having fun sitting on the ${surfaceName(x, y)}?`);
    }
    game.context.move = 1;
}
