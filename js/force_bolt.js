// Force-bolt and striking-wand combat.
// C refs: zap.c bhit(), bhitm(), zap_steed(), and zapyourself().

import { exerciseAttribute } from './attrib.js';
import { adjustHeroAlignment } from './alignment.js';
import {
    A_STR, COLNO, DOOR, D_BROKEN, D_CLOSED, D_LOCKED, D_NODOOR,
    D_TRAPPED, CORPSTAT_HISTORIC, M_AP_MONSTER, ROWNO, SDOOR,
    Upolyd, ZAP_POS,
} from './const.js';
import {
    canProjectMonster, newsym, pline, randomDisplayMonsterName, shieldeff,
} from './display.js';
import { finishHeroDeath } from './end.js';
import { engravingAt, wipeEngravingAt } from './engrave.js';
import { game } from './gstate.js';
import { finishHeroMonsterKill } from './hero_monster_death.js';
import { place_object, remove_object } from './mklev.js';
import { wakeMonstersNear } from './mon.js';
import { wakeAttackedMonster } from './monster_anger.js';
import { MONSTER_NAME } from './monster_data.js';
import { monsterResistsEffect } from './monster_resistance.js';
import { findMonsterArmorClass } from './monworn.js';
import {
    BOULDER, OBJECT_USES_KNOWN, ROCK, STATUE,
} from './object_data.js';
import { rehumanizeHero } from './polyself.js';
import { d, rn2, rnd } from './rng.js';
import { adjustSpellDamage } from './spell_damage.js';
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

async function breakRockObjects(x, y, state, random) {
    const pile = [...(state.level?.objects?.[x]?.[y] || [])];
    let hit = false;
    let identified = false;
    for (const object of pile) {
        if (object.otyp !== BOULDER && object.otyp !== STATUE) continue;
        const visible = cansee(x, y);
        const audible = !state.u?.deaf && !state.deaf;
        if (object.otyp === BOULDER) {
            if (visible) await pline('The boulder falls apart.');
            else if (audible) await pline('You hear a crumbling sound.');
            await turnIntoRocks(object, x, y, state, random);
        } else {
            await turnIntoRocks(object, x, y, state, random);
            if (visible) {
                const subject = state.u?.hallucinating
                    ? randomDisplayMonsterName() : 'statue';
                await pline(`The ${subject} shatters.`);
            } else if (audible) {
                await pline('You hear a crumbling sound.');
            }
        }
        hit = true;
        if (visible || audible) identified = true;
    }
    return { hit, identified };
}

function revealMimic(monster, revealMonsterDisguise = true) {
    if (!monster.m_ap_type) return;
    if (!revealMonsterDisguise && monster.m_ap_type === M_AP_MONSTER)
        return;
    monster.m_ap_type = 0;
    monster.mappearance = 0;
    newsym(monster.mx, monster.my);
}

function monsterName(monster) {
    return MONSTER_NAME[monster.mnum] || 'monster';
}

async function hitMonster(monster, source, state, options) {
    const attackLevel = source === 'wand' ? 12 : state.u?.ulevel ?? 1;
    const targetCellWasVisible = cansee(monster.mx, monster.my);
    if (monsterResistsEffect(monster, attackLevel, options.random)) {
        revealMimic(monster, false);
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

    revealMimic(monster);
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

export async function forceBoltInDirection(direction, {
    source = 'wand',
    state = game,
    random = rn2,
    roll = rnd,
    rollDice = d,
    finishMonsterKill = finishHeroMonsterKill,
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
        const objects = await breakRockObjects(
            state.u.ux, state.u.uy, state, random,
        );
        if (engravingAt(state.u.ux, state.u.uy, state.level)) {
            wipeEngravingAt(
                state.u.ux, state.u.uy, rollDice(2, 4), true, state.level,
            );
        }
        return objects.identified;
    }
    if (direction === '<') return false;

    const dx = DIR_DX[direction], dy = DIR_DY[direction];
    if (dx === undefined || dy === undefined) return false;
    let x = state.u.ux, y = state.u.uy;
    let range = 6 + random(8);
    let identified = false;
    while (range-- > 0) {
        x += dx;
        y += dy;
        if (x < 1 || x >= COLNO || y < 0 || y >= ROWNO) break;
        const monster = monsterAt(x, y, state);
        if (monster) {
            if (await hitMonster(monster, source, state, options))
                identified = true;
            range -= 3;
        }
        const objects = await breakRockObjects(x, y, state, random);
        if (objects.hit) range--;
        if (objects.identified) identified = true;
        if (await breakDoor(x, y, state)) identified = true;
        if (!rayCellIsOpen(x, y, state)) break;
    }
    return identified;
}
