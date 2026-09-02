// Force-bolt and striking-wand combat.
// C refs: zap.c bhit(), bhitm(), zap_steed(), and zapyourself().

import { exerciseAttribute } from './attrib.js';
import { adjustHeroAlignment } from './alignment.js';
import { objectIsHardHelmet } from './armor.js';
import {
    A_STR, COLNO, DOOR, D_BROKEN, D_CLOSED, D_LOCKED, D_NODOOR,
    D_TRAPPED, CORPSTAT_HISTORIC, DRAWBRIDGE_DOWN, DRAWBRIDGE_UP,
    Is_airlevel, Is_waterlevel, HOLE, ROWNO, SDOOR,
    STATUE_TRAP, TRAPDOOR, Upolyd, ZAP_POS,
} from './const.js';
import {
    canProjectMonster, newsym, pline, randomDisplayMonsterName, shieldeff,
} from './display.js';
import { destroyDrawbridge, findDrawbridgeAt } from './dbridge.js';
import { finishHeroDeath } from './end.js';
import { engravingAt, wipeEngravingAt } from './engrave.js';
import { game } from './gstate.js';
import { prepareHoleFall } from './hero_traps.js';
import { finishHeroMonsterKill } from './hero_monster_death.js';
import {
    mksobj, place_object, remove_object, stack_object,
} from './mklev.js';
import { wakeMonstersNear } from './mon.js';
import { wakeAttackedMonster } from './monster_anger.js';
import { revealMonsterAppearance } from './monster_appearance.js';
import { MONSTER_NAME } from './monster_data.js';
import { monsterResistsEffect } from './monster_resistance.js';
import { breakFloorObject } from './object_breakage.js';
import { findMonsterArmorClass } from './monworn.js';
import {
    BOULDER, OBJECT_USES_KNOWN, ROCK, STATUE,
} from './object_data.js';
import {
    heroFormHidesUnderObjects, rehumanizeHero,
} from './polyself.js';
import { d, rn2, rnd } from './rng.js';
import { adjustSpellDamage } from './spell_damage.js';
import { activateStatueTrapAt } from './statue_trap.js';
import { cansee, vision_note_blocker_change } from './vision.js';
import { objectWeight } from './weight.js';

const GEM_CLASS = 13;

const DIR_DX = {
    h: -1, l: 1, j: 0, k: 0, y: -1, u: 1, b: -1, n: 1,
};
const DIR_DY = {
    h: 0, l: 0, j: 1, k: -1, y: -1, u: -1, b: 1, n: 1,
};

function monsterAt(x, y, state) {
    return state.level?.monsters?.find(monster =>
        (monster.mhp ?? 1) > 0 && monster.mx === x && monster.my === y,
    ) || null;
}

function rayCellIsOpen(x, y, state) {
    const location = state.level?.at(x, y);
    if (!location || !ZAP_POS(location.typ)) return false;
    return location.typ !== DOOR
        || !(location.doormask & (D_CLOSED | D_LOCKED));
}

async function breakDoor(x, y, state) {
    const door = state.level?.at(x, y);
    if (!door || door.typ !== DOOR && door.typ !== SDOOR) return false;

    if (door.typ === SDOOR) {
        const trapped = (door.doormask ?? 0) & D_TRAPPED;
        door.typ = DOOR;
        door.doormask = D_CLOSED | trapped;
        newsym(x, y);
        if (cansee(x, y)) await pline('A door appears in the wall!');
    }
    if (!(door.doormask & (D_CLOSED | D_LOCKED))) return false;

    const visible = cansee(x, y) && !state.u?.unaware;
    const trapped = !!(door.doormask & D_TRAPPED);
    door.doormask = trapped ? D_NODOOR : D_BROKEN;
    vision_note_blocker_change(x, y);
    newsym(x, y);
    if (trapped) {
        if (visible) await pline('KABOOM!!  You see a door explode.');
        else if (!state.u?.deaf && !state.deaf)
            await pline('You hear an explosion.');
        wakeMonstersNear(x, y, 40, state);
    } else {
        if (visible) await pline('The door crashes open!');
        else if (!state.u?.deaf && !state.deaf)
            await pline('You hear a crashing sound.');
        wakeMonstersNear(x, y, 20, state);
    }
    return true;
}

function recordSokobanBoulderBreak(state) {
    if (!state.level?.flags?.sokoban_rules) return;
    if (!state.u.uconduct) state.u.uconduct = {};
    state.u.uconduct.sokocheat = (state.u.uconduct.sokocheat ?? 0) + 1;
    state.u.uluck = (state.u.uluck ?? 0) - 1;
}

function dropStatueContents(statue, x, y) {
    for (const object of statue.contents || []) {
        object.where = 'free';
        place_object(object, x, y);
    }
    statue.contents = [];
}

async function turnIntoRocks(object, x, y, state, random) {
    if (object.otyp === BOULDER) recordSokobanBoulderBreak(state);
    if (object.otyp === STATUE) {
        dropStatueContents(object, x, y);
        if (state.urole?.key === 'archeologist'
            && ((object.spe ?? 0) & CORPSTAT_HISTORIC)) {
            await pline(
                'You feel guilty about damaging such a historic statue.',
            );
            adjustHeroAlignment(-1, state);
        }
        object.spe = 0;
    }

    remove_object(object);
    object.otyp = ROCK;
    object.oclass = GEM_CLASS;
    object.quan = object.quantity = 7 + random(60);
    object.dknown = object.bknown = object.rknown = false;
    object.known = OBJECT_USES_KNOWN[ROCK] ? 0 : 1;
    delete object.oextra;
    delete object.corpsenm;
    object.owt = objectWeight(object);
    place_object(object, x, y);
    vision_note_blocker_change(x, y);
    newsym(x, y);
}

async function breakFloorObjects(x, y, state, options, direction = null) {
    const originalPile = state.level?.objects?.[x]?.[y] || [];
    if (!originalPile.length) return { rangeHit: false, identified: false };

    let rangeHit = false;
    let identified = false;
    const hidingUnder = !!state.u?.uundetected
        && heroFormHidesUnderObjects(state);
    const originalTop = originalPile[0];
    const upward = direction === '<';
    const downward = direction === '>';
    if (upward && !hidingUnder)
        return { rangeHit: false, identified: false };

    const statueTrap = state.level?.traps?.some(trap =>
        trap.tx === x && trap.ty === y && trap.ttyp === STATUE_TRAP,
    );
    let releasedMonster = null;
    if (statueTrap && (!upward || originalTop.otyp === STATUE)) {
        releasedMonster = await activateStatueTrapAt(
            x, y, { state, shatter: true },
        );
        if (releasedMonster && !upward) identified = true;
    }

    if (upward && releasedMonster)
        return { rangeHit: false, identified };

    let pile;
    if (upward) {
        pile = [originalTop];
    } else {
        pile = [...(state.level?.objects?.[x]?.[y] || [])];
        const topChanged = pile[0] !== originalTop;
        if (downward && hidingUnder && !topChanged) pile = pile.slice(1);
    }
    for (const object of pile) {
        if (object.where !== 'floor' || object.ox !== x || object.oy !== y)
            continue;
        if (object.otyp !== BOULDER && object.otyp !== STATUE) {
            const result = await breakFloorObject(object, {
                state,
                random: options.random,
                rollDice: options.rollDice,
                finishMonsterKill: options.finishMonsterKill,
            });
            if (result.observed) identified = true;
            continue;
        }
        const visible = cansee(x, y);
        const audible = !state.u?.deaf && !state.deaf;
        if (object.otyp === BOULDER) {
            if (visible) await pline('The boulder falls apart.');
            else if (audible) await pline('You hear a crumbling sound.');
            await turnIntoRocks(object, x, y, state, options.random);
        } else {
            await turnIntoRocks(object, x, y, state, options.random);
            if (visible) {
                const subject = state.u?.hallucinating
                    ? randomDisplayMonsterName() : 'statue';
                await pline(`The ${subject} shatters.`);
            } else if (audible) {
                await pline('You hear a crumbling sound.');
            }
        }
        rangeHit = true;
        if (visible || audible) identified = true;
    }
    return { rangeHit, identified };
}

async function breakTrapdoor(state) {
    const trap = state.level?.traps?.find(candidate =>
        candidate.tx === state.u.ux && candidate.ty === state.u.uy
        && candidate.ttyp === TRAPDOOR,
    );
    if (!trap) return null;

    const identified = !!trap.tseen;
    if (state.blind && !trap.tseen)
        await pline('Something beneath you shatters.');
    else if (!trap.tseen)
        await pline("There's a trapdoor beneath you; it shatters.");
    else
        await pline('The trapdoor beneath you shatters.');
    trap.ttyp = HOLE;
    trap.tseen = true;
    newsym(state.u.ux, state.u.uy);
    return {
        fall: await prepareHoleFall(trap),
        identified,
    };
}

function monsterName(monster) {
    return MONSTER_NAME[monster.mnum] || 'monster';
}

async function hitMonster(monster, source, state, options) {
    const attackLevel = source === 'wand' ? 12 : state.u?.ulevel ?? 1;
    const targetCellWasVisible = cansee(monster.mx, monster.my);
    if (monsterResistsEffect(monster, attackLevel, options.random)) {
        revealMonsterAppearance(monster, {
            includeMonsterDisguise: false,
        });
        await shieldeff(monster.mx, monster.my, state);
        await pline('Boing!');
        await wakeAttackedMonster(monster);
        return targetCellWasVisible;
    }

    const hit = (state.u?.uswallow && state.u?.ustuck === monster)
        || options.roll(20) < 10 + findMonsterArmorClass(monster);
    if (!hit) {
        if (!monster.m_ap_type
            && canProjectMonster(monster, monster.mx, monster.my)) {
            await pline(`The ${source} misses the ${monsterName(monster)}.`);
        }
        await wakeAttackedMonster(monster);
        return false;
    }

    revealMonsterAppearance(monster);
    let damage = options.rollDice(2, 12);
    if (state.urole?.key === 'knight' && state.u?.uhave?.questart)
        damage *= 2;
    if (source === 'spell') damage = adjustSpellDamage(damage, state);

    if (canProjectMonster(monster, monster.mx, monster.my)) {
        await pline(
            `The ${source} hits the ${monsterName(monster)}${
                damage <= 4 ? '.' : '!'
            }`,
        );
    }
    if (monsterResistsEffect(monster, attackLevel, options.random)) {
        damage = Math.ceil(damage / 2);
        await shieldeff(monster.mx, monster.my, state);
    }
    monster.mhp = (monster.mhp ?? 1) - damage;
    if (monster.mhp <= 0) {
        await options.finishMonsterKill(monster, monster.mx, monster.my, {
            weaponHit: false,
        });
    } else {
        await wakeAttackedMonster(monster);
    }
    return targetCellWasVisible;
}

async function hitHero(state, options) {
    if (state.u?.antimagic || state.u?.magicProtection) {
        await shieldeff(state.u.ux, state.u.uy, state);
        await pline('Boing!');
        return true;
    }

    await pline('You bash yourself!');
    let damage = options.rollDice(2, 12);
    if (state.u?.halfPhysicalDamage || state.u?.half_physical_damage)
        damage = Math.ceil(damage / 2);
    exerciseAttribute(A_STR, false, state);

    const hitPoints = Upolyd(state.u) ? 'mh' : 'uhp';
    state.u[hitPoints] = Math.max(
        0, (state.u[hitPoints] ?? 1) - damage,
    );
    if (state.u[hitPoints] > 0) return true;
    if (Upolyd(state.u)) {
        const restored = rehumanizeHero(state);
        if (restored.changed)
            await pline(`You return to ${restored.race} form!`);
        return true;
    }
    await finishHeroDeath({ killer: 'self-inflicted injury' });
    return true;
}

function onQuestStartLevel(state) {
    const level = state.u?.uz;
    return !!level && level.dnum === state.quest_dnum
        && level.dlevel === 1;
}

async function dropRockFromCeiling(state, random, roll) {
    if (random(3) === 0) return false;
    if (Is_airlevel(state.u?.uz) || Is_waterlevel(state.u?.uz)
        || state.underwater || state.u?.uinwater
        || onQuestStartLevel(state)) return false;

    await pline(
        'A rock is dislodged from the ceiling and falls on your head.',
    );
    const helmet = state.uarmh || state.u?.uarmh;
    let damage = roll(objectIsHardHelmet(helmet) ? 2 : 6);
    if (state.u?.halfPhysicalDamage || state.u?.half_physical_damage)
        damage = Math.ceil(damage / 2);
    const hitPoints = Upolyd(state.u) ? 'mh' : 'uhp';
    state.u[hitPoints] = Math.max(
        0, (state.u[hitPoints] ?? 1) - damage,
    );
    if (state.u[hitPoints] <= 0) {
        if (Upolyd(state.u)) {
            const restored = rehumanizeHero(state);
            if (restored.changed)
                await pline(`You return to ${restored.race} form!`);
        } else {
            await finishHeroDeath({ killer: 'falling rock' });
            return true;
        }
    }

    const rock = mksobj(ROCK, false, false);
    rock.dknown = true;
    place_object(rock, state.u.ux, state.u.uy);
    stack_object(rock, state);
    newsym(state.u.ux, state.u.uy);
    return true;
}

async function destroyVerticalDrawbridge(direction, state, options) {
    const x = state.u.ux;
    const y = state.u.uy;
    const bridge = findDrawbridgeAt(x, y, state);
    if (!bridge) return false;
    const location = state.level.at(x, y);
    const loweredSpan = location.typ === DRAWBRIDGE_DOWN && direction === '>';
    const openPortcullis = location.typ === DOOR;
    if (!loweredSpan && !openPortcullis) return false;
    return destroyDrawbridge(bridge.x, bridge.y, state, options);
}

async function destroyHorizontalDrawbridge(x, y, state, options) {
    const bridge = findDrawbridgeAt(x, y, state);
    if (!bridge || state.level.at(x, y).typ === DRAWBRIDGE_UP) return false;
    return destroyDrawbridge(bridge.x, bridge.y, state, options);
}

export async function forceBoltInDirection(direction, {
    source = 'wand',
    state = game,
    random = rn2,
    roll = rnd,
    rollDice = d,
    finishMonsterKill = finishHeroMonsterKill,
    gotoLevel = null,
} = {}) {
    const options = { random, roll, rollDice, finishMonsterKill };
    if (state.u?.uswallow && state.u?.ustuck) {
        return hitMonster(state.u.ustuck, source, state, options);
    }
    if (direction === '.') return hitHero(state, options);
    if (direction === '>' && state.u?.usteed) {
        await hitMonster(state.u.usteed, source, state, options);
        return true;
    }
    if (direction === '>') {
        const bridgeDestroyed = await destroyVerticalDrawbridge(
            direction, state, options,
        );
        const trapdoor = bridgeDestroyed ? null : await breakTrapdoor(state);
        const objects = await breakFloorObjects(
            state.u.ux, state.u.uy, state, options, direction,
        );
        if (engravingAt(state.u.ux, state.u.uy, state.level)) {
            wipeEngravingAt(
                state.u.ux, state.u.uy, rollDice(2, 4), true, state.level,
            );
        }
        if (trapdoor?.fall && gotoLevel) {
            await gotoLevel(
                trapdoor.fall.destination,
                { arrival: trapdoor.fall.arrival },
            );
        }
        return bridgeDestroyed || objects.identified || !!trapdoor?.identified;
    }
    if (direction === '<') {
        const bridgeDestroyed = await destroyVerticalDrawbridge(
            direction, state, options,
        );
        if (!bridgeDestroyed) await dropRockFromCeiling(state, random, roll);
        const objects = await breakFloorObjects(
            state.u.ux, state.u.uy, state, options, direction,
        );
        return bridgeDestroyed || objects.identified;
    }

    const dx = DIR_DX[direction], dy = DIR_DY[direction];
    if (dx === undefined || dy === undefined) return false;
    let x = state.u.ux, y = state.u.uy;
    let range = 6 + random(8);
    let identified = false;
    while (range-- > 0) {
        x += dx;
        y += dy;
        if (x < 1 || x >= COLNO || y < 0 || y >= ROWNO) break;
        if (await destroyHorizontalDrawbridge(x, y, state, options))
            identified = true;
        const monster = monsterAt(x, y, state);
        if (monster) {
            if (await hitMonster(monster, source, state, options))
                identified = true;
            range -= 3;
        }
        const objects = await breakFloorObjects(x, y, state, options);
        if (objects.rangeHit) range--;
        if (objects.identified) identified = true;
        if (await breakDoor(x, y, state)) identified = true;
        if (!rayCellIsOpen(x, y, state)) break;
    }
    return identified;
}
