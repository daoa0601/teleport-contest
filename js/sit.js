// #sit and the immediate consequences of sitting down.
// C ref: sit.c dosit() and lay_an_egg().

import {
    A_STR, A_WIS, ALTAR, DRAWBRIDGE_DOWN, FOUNTAIN, GRAVE, ICE, ROOM,
    IS_LAVA, IS_POOL, LADDER, SINK, SPIKED_PIT, STAIRS, THRONE,
    TT_BEARTRAP, TT_BURIEDBALL, TT_INFLOOR, TT_LAVA, TT_PIT, TT_WEB,
} from './const.js';
import { exerciseAttribute } from './attrib.js';
import { pline } from './display.js';
import { game } from './gstate.js';
import { heroCanReachFloor } from './floor_reach.js';
import { burnAwayHeroSlime } from './hack.js';
import {
    mksobj, place_object, remove_object, set_corpsenm, stack_object,
} from './mklev.js';
import {
    MONSTER_ATTACKS, MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_NAME,
    MONSTER_SYMBOL,
} from './monster_data.js';
import {
    CHEST, CORPSE, CREAM_PIE, EGG, LARGE_BOX, OBJECT_MATERIAL, OBJECT_NAMES,
    OBJECT_NUTRITION, TOWEL, WATER_WALKING_BOOTS,
} from './object_data.js';
import { recordObjectEncounter } from './object_knowledge.js';
import { heroGoldAmount } from './hero_gold.js';
import { altarWrath } from './pray.js';
import { d, rnd, rn2 } from './rng.js';
import { waterDamageObject } from './trap.js';
import { objectWeight } from './weight.js';
import { throneSitEffect } from './throne.js';
import { splitSittingGremlin } from './fountain.js';
import { triggerHeroTrap } from './hero_traps.js';

const COIN_CLASS = 12;
const CLOTH = 6;
const M1_SWIM = 0x00000002;
const M1_AMORPHOUS = 0x00000004;
const M1_HIDE = 0x00000100;
const M1_HUMANOID = 0x00020000;
const M1_SLITHY = 0x00080000;
const M1_OVIPAROUS = 0x00400000;
const M2_NEUTER = 0x00040000;
const S_DRAGON = 30;
const S_EEL = 57;
const AT_HUGS = 7;
const AT_ENGL = 11;
const AD_WRAP = 18;
const AD_STCK = 19;
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

function currentForm() {
    const u = game.u;
    if (!Number.isInteger(u?.umonnum)) return null;
    return (u.mtimedone ?? 0) > 0
        || (Number.isInteger(u.umonster) && u.umonnum !== u.umonster)
        ? u.umonnum : null;
}

function formFlags() {
    const form = currentForm();
    return form == null ? 0 : (MONSTER_FLAGS1[form] ?? 0);
}

function formSticks() {
    const attacks = MONSTER_ATTACKS[currentForm()] || [];
    return attacks.some(([attackType, damageType]) =>
        damageType === AD_STCK
        || (damageType === AD_WRAP && attackType !== AT_ENGL)
        || attackType === AT_HUGS);
}

function monsterName(monster) {
    return monster?.name || MONSTER_NAME[monster?.mnum] || 'monster';
}

function holderSubject(monster) {
    const name = monsterName(monster);
    return monster?.name
        ? name.charAt(0).toUpperCase() + name.slice(1)
        : `The ${name}`;
}

function holderPossessive(monster) {
    if ((MONSTER_FLAGS2[monster?.mnum] ?? 0) & M2_NEUTER) return 'its';
    return monster?.female ? 'her' : 'his';
}

function formIsHumanoid() {
    return currentForm() == null || !!(formFlags() & M1_HUMANOID);
}

function objectQuantity(object) {
    return object?.quan ?? object?.quantity ?? 1;
}

function objectName(object) {
    const quantity = objectQuantity(object);
    const singular = object?.name || OBJECT_NAMES[object?.otyp] || 'object';
    const plural = object?.plural || `${singular}s`;
    return quantity === 1 ? singular : `${quantity} ${plural}`;
}

function surfaceName(typ) {
    if (IS_POOL(typ)) return 'water';
    if (IS_LAVA(typ)) return 'lava';
    if (typ === ICE) return 'ice';
    if (typ === DRAWBRIDGE_DOWN) return 'bridge';
    if (typ === ALTAR) return 'altar';
    if (typ === GRAVE) return 'headstone';
    if (typ === FOUNTAIN) return 'fountain';
    if (typ === STAIRS || typ === LADDER) return 'stairs';
    return typ >= ROOM ? 'floor' : 'ground';
}

function waterEggLayer() {
    const form = currentForm();
    return form != null
        && (formFlags() & (M1_OVIPAROUS | M1_SWIM))
            === (M1_OVIPAROUS | M1_SWIM)
        && MONSTER_SYMBOL[form] === S_EEL;
}

function eggTypeFromParent(parent) {
    if (rn2(77) === 0) return parent;
    if (parent === PM_QUEEN_BEE) return 1;
    if (parent === PM_WINGED_GARGOYLE) return PM_GARGOYLE;
    return parent;
}

async function layEgg() {
    const form = currentForm();
    if (game.flags?.female !== true) {
        await pline('Males can\'t lay eggs!');
        return false;
    }
    const nutrition = OBJECT_NUTRITION[EGG] ?? 0;
    if ((game.u?.uhunger ?? 0) < nutrition) {
        await pline("You don't have enough energy to lay an egg.");
        return false;
    }
    if (waterEggLayer()) {
        if (!(game.underwater || game.u?.uinwater
            || game.level?.flags?.is_waterlevel)) {
            await pline('A splash tetra you are not.');
            return false;
        }
        if (form === PM_GIANT_EEL || form === PM_ELECTRIC_EEL) {
            await pline('You yearn for the Sargasso Sea.');
            return false;
        }
    }

    const egg = mksobj(EGG, false, false);
    egg.spe = 1;
    egg.quan = egg.quantity = 1;
    set_corpsenm(egg, eggTypeFromParent(form));
    egg.known = true;
    egg.dknown = true;
    egg.owt = objectWeight(egg);
    recordObjectEncounter(EGG);
    await pline(`You ${waterEggLayer() ? 'spawn' : 'lay'} an egg.`);
    place_object(egg, game.u.ux, game.u.uy);
    stack_object(egg);
    game.u.uhunger -= nutrition;
    return true;
}

async function sitOnObject(object) {
    if (MONSTER_SYMBOL[currentForm()] === S_DRAGON
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

    const name = objectName(object);
    await pline(formFlags() & M1_SLITHY
        ? `You coil up around the ${name}.`
        : `You sit on the ${name}.`);
    if (object.otyp === CORPSE
        && (MONSTER_FLAGS1[object.corpsenm] ?? 0) & M1_AMORPHOUS) {
        await pline("It's squishy...");
    } else if (object.otyp === CREAM_PIE) {
        if (!(game.deaf || game.u?.deaf)) await pline('Squelch!');
        remove_object(object);
        object.quan = object.quantity = 0;
        object.where = 'gone';
        object.ox = object.oy = 0;
    } else if (object.otyp !== LARGE_BOX && object.otyp !== CHEST
        && OBJECT_MATERIAL[object.otyp] !== CLOTH) {
        await pline("It's not very comfortable...");
    }
}

async function sitWhileTrapped(trap) {
    const u = game.u;
    exerciseAttribute(A_WIS, false);
    if (u.utraptype === TT_BEARTRAP) {
        await pline("You can't sit down with your foot in the bear trap.");
        u.utrap++;
    } else if (u.utraptype === TT_PIT) {
        if (trap?.ttyp === SPIKED_PIT) {
            await pline('You sit down on a spike.  Ouch!');
            const damage = u.halfPhysicalDamage || u.half_physical_damage
                ? rn2(2) : 1;
            u.uhp = Math.max(0, (u.uhp ?? 1) - damage);
            exerciseAttribute(A_STR, false);
        } else {
            await pline('You sit down in the pit.');
        }
        u.utrap += rn2(5);
    } else if (u.utraptype === TT_WEB) {
        await pline('You sit in the spider web and get entangled further!');
        u.utrap += 5 + rn2(10);
    } else if (u.utraptype === TT_LAVA) {
        await pline('You sit in the lava!');
        await burnAwayHeroSlime(game, pline);
        u.utrap += rnd(4);
        u.uhp = Math.max(0, (u.uhp ?? 1) - d(2, 10));
    } else if (u.utraptype === TT_INFLOOR
        || u.utraptype === TT_BURIEDBALL) {
        await pline("You can't maneuver to sit!");
        u.utrap++;
    }
}

async function sitInWater() {
    await pline('You sit in the water.');
    if (currentForm() === PM_GREMLIN) {
        await splitSittingGremlin();
        return;
    }

    const messages = [];
    const armor = game.uarm || game.u?.uarm;
    const boots = game.uarmf || game.u?.uarmf;
    if (armor && rn2(10) === 0)
        await waterDamageObject(armor, messages, game);
    if (boots?.otyp !== WATER_WALKING_BOOTS && boots
        && rn2(10) === 0) {
        // sit.c passes uarm here too; preserve that behavior from the pinned
        // source rather than silently changing which item gets wet.
        await waterDamageObject(armor, messages, game);
    }
    for (const message of messages) await pline(message);
}

function formLikesLava() {
    return [
        PM_FIRE_VORTEX, PM_FLAMING_SPHERE, PM_FIRE_ELEMENTAL, PM_SALAMANDER,
    ].includes(currentForm());
}

export async function dosit({
    finishTeleport = null,
    gotoLevel = null,
    chooseTeleportDestination = null,
} = {}) {
    const u = game.u;
    const x = u?.ux;
    const y = u?.uy;
    const location = game.level?.at(x, y);
    const typ = location?.typ;
    const trap = game.level?.traps?.find(candidate =>
        candidate.tx === x && candidate.ty === y) || null;

    if (u?.usteed) {
        await pline(`You are already sitting on ${monsterName(u.usteed)}.`);
        game.context.move = 0;
        return;
    }
    if (u?.uundetected && (formFlags() & M1_HIDE)
        && currentForm() !== PM_TRAPPER) u.uundetected = 0;

    if (!heroCanReachFloor(game)) {
        if (u?.uswallow) await pline('There are no seats in here!');
        else if (u?.levitating || game.levitating)
            await pline('You tumble in place.');
        else await pline('You are sitting on air.');
        game.context.move = 0;
        return;
    }
    if (u?.ustuck && !formSticks()) {
        const holder = u.ustuck;
        const humanoid = (MONSTER_FLAGS1[holder.mnum] ?? 0) & M1_HUMANOID;
        await pline(humanoid
            ? `${holderSubject(holder)} won't offer ${
                holderPossessive(holder)
            } lap.`
            : `${holderSubject(holder)} has no lap.`);
        game.context.move = 0;
        return;
    }

    const onPool = IS_POOL(typ);
    if ((onPool && !(game.underwater || u?.uinwater))
        || (currentForm() === PM_GREMLIN
            && (typ === FOUNTAIN || onPool))) {
        await sitInWater();
        game.context.move = 1;
        return;
    }

    const object = game.level?.objects?.[x]?.[y]?.[0];
    if (object) {
        await sitOnObject(object);
    } else if (trap || (u?.utrap && u.utraptype >= TT_LAVA)) {
        if (u?.utrap) await sitWhileTrapped(trap);
        else {
            await pline(`You ${u?.flying || game.flying ? 'land' : 'sit down'}.`);
            await triggerHeroTrap(trap, {
                finishTeleport,
                gotoLevel,
                viaSitting: true,
            });
        }
    } else if ((game.underwater || u?.uinwater
        || game.level?.flags?.is_waterlevel) && !waterEggLayer()) {
        await pline(game.level?.flags?.is_waterlevel
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
        await pline('You sit on the lava.');
        await burnAwayHeroSlime(game, pline);
        if (formLikesLava()) {
            await pline('The lava feels warm.');
        } else {
            await pline('The lava burns you!');
            const dice = u?.fireResistance ? 2 : 10;
            u.uhp = Math.max(0, (u.uhp ?? 1) - d(dice, 10));
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
    } else if (formFlags() & M1_OVIPAROUS) {
        if (!await layEgg()) {
            game.context.move = 0;
            return;
        }
    } else {
        await pline(`Having fun sitting on the ${surfaceName(typ)}?`);
    }
    game.context.move = 1;
}
