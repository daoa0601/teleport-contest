// Directional undead turning from a spell or wand.
// C refs: zap.c bhit(), bhitm(), bhito(), unturn_dead(), and unturn_you().

import {
    COLNO, DOOR, D_CLOSED, D_LOCKED, G_GENOD, ROWNO, ZAP_POS,
} from './const.js';
import {
    canProjectMonster, pline, shieldeff,
} from './display.js';
import { reviveCorpseByMagic } from './corpse_revival.js';
import { finishHeroMonsterKill } from './hero_monster_death.js';
import { game } from './gstate.js';
import { restartEggHatchTimer } from './mklev.js';
import { wakeAttackedMonster } from './monster_anger.js';
import { makeMonsterFlee } from './monster_flee.js';
import {
    MONSTER_FLAGS1, monsterIsUndead, monsterIsVampireShifter,
    monsterTypeName, monsterYoungerForm,
} from './monster_data.js';
import { monsterResistsEffect } from './monster_resistance.js';
import { CORPSE, EGG } from './object_data.js';
import { rn2, rnd } from './rng.js';
import { adjustSpellDamage } from './spell_damage.js';
import { cansee } from './vision.js';

const M1_CONCEAL = 0x00000080;
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

function eggCanHatch(egg, state) {
    const mnum = egg?.corpsenm;
    if (!Number.isInteger(mnum) || mnum < 0) return false;
    const younger = monsterYoungerForm(mnum);
    return [mnum, younger].filter(Number.isInteger).every(species =>
        !((state.mvitals?.[species]?.mvflags ?? 0) & G_GENOD));
}

async function announceRevival(event) {
    const x = event?.location?.x ?? event?.monster?.mx;
    const y = event?.location?.y ?? event?.monster?.my;
    if (!event?.monster || !cansee(x, y)) return;
    const name = monsterTypeName(
        event.monster.mnum, !!event.monster.female,
    );
    await pline(`The ${name} is resurrected!`);
}

async function turnObject(object, state) {
    if (object.otyp === EGG) {
        if (eggCanHatch(object, state)) restartEggHatchTimer(object);
        return true;
    }
    if (object.otyp !== CORPSE) {
        // NetHack counts another floor object as a beam hit even though
        // undead turning leaves that object unchanged.
        return true;
    }

    const event = await reviveCorpseByMagic(object, state);
    if (event?.kind !== 'revived') return false;
    for (const message of event.messages || []) await pline(message);
    await announceRevival(event);
    return true;
}

async function turnCarriedObjects(inventory, state) {
    let revived = 0;
    for (const object of [...(inventory || [])]) {
        if (object.otyp === EGG) {
            if (eggCanHatch(object, state)) restartEggHatchTimer(object);
            continue;
        }
        if (object.otyp !== CORPSE) continue;
        const event = await reviveCorpseByMagic(object, state);
        if (event?.kind !== 'revived') continue;
        revived++;
        for (const message of event.messages || []) await pline(message);
        await announceRevival(event);
    }
    return revived;
}

async function turnMonster(monster, source, state, options) {
    const inventory = monster.minvent || monster.inventory || [];
    const revived = await turnCarriedObjects(inventory, state);
    const affected = monsterIsUndead(monster.mnum)
        || monsterIsVampireShifter(monster);
    if (!affected) {
        if (revived) await options.wakeMonster(monster);
        return;
    }

    let damage = options.roll(8);
    if (state.urole?.key === 'knight' && state.u?.uhave?.questart)
        damage *= 2;
    if (source === 'spell') damage = adjustSpellDamage(damage, state);

    const attackLevel = source === 'wand' ? 12 : state.u?.ulevel ?? 1;
    const resisted = monsterResistsEffect(
        monster, attackLevel, options.random,
    );
    if (resisted) {
        damage = Math.ceil(damage / 2);
        if (canProjectMonster(monster, monster.mx, monster.my))
            await shieldeff(monster.mx, monster.my, state);
    }
    monster.mhp -= damage;
    if (monster.mhp <= 0) {
        await options.finishMonsterKill(monster, monster.mx, monster.my);
        return;
    }
    if (!resisted) await makeMonsterFlee(monster, state);
    await options.wakeMonster(monster);
}

async function turnFloorPile(x, y, state) {
    const pile = [...(state.level?.objects?.[x]?.[y] || [])];
    let affected = false;
    for (const object of pile) {
        if (await turnObject(object, state)) affected = true;
    }
    return affected;
}

function rayCellIsOpen(x, y, state) {
    if (x < 1 || x >= COLNO || y < 0 || y >= ROWNO) return false;
    const location = state.level?.at(x, y);
    if (!location || !ZAP_POS(location.typ)) return false;
    return location.typ !== DOOR
        || !(location.doormask & (D_CLOSED | D_LOCKED));
}

async function turnHero(state, options) {
    await turnCarriedObjects(state.inventory, state);
    if (monsterIsUndead(state.u?.umonnum)) {
        const alreadyStunned = (state.u?.stunnedTurns ?? 0) > 0;
        await pline(
            `You feel frightened and ${alreadyStunned ? 'even more ' : ''}stunned.`,
        );
        state.u.stunnedTurns = (state.u.stunnedTurns ?? 0) + options.roll(30);
        state.u.stunned = true;
    } else {
        await pline('You shudder in dread.');
    }
}

export async function turnUndeadInDirection(direction, {
    source = 'wand',
    state = game,
    random = rn2,
    roll = rnd,
    finishMonsterKill = finishHeroMonsterKill,
    wakeMonster = wakeAttackedMonster,
} = {}) {
    const options = {
        random, roll, finishMonsterKill, wakeMonster,
    };
    if (state.u?.uswallow && state.u?.ustuck) {
        await turnMonster(state.u.ustuck, source, state, options);
        return true;
    }
    if (direction === '.') {
        await turnHero(state, options);
        return true;
    }
    if (direction === '>')
        return turnFloorPile(state.u.ux, state.u.uy, state);
    if (direction === '<') {
        const hidesUnder = !!((MONSTER_FLAGS1[state.u?.umonnum] ?? 0)
            & M1_CONCEAL);
        if (!state.u?.uundetected || !hidesUnder) return false;
        const object = state.level?.objects?.[state.u.ux]?.[state.u.uy]?.[0];
        const affected = object ? await turnObject(object, state) : false;
        state.u.uundetected = !!state.level?.objects?.[state.u.ux]?.[state.u.uy]
            ?.length;
        return affected;
    }

    const dx = DIR_DX[direction], dy = DIR_DY[direction];
    if (dx === undefined || dy === undefined) return false;
    let x = state.u.ux, y = state.u.uy;
    let range = 6 + random(8);
    while (range-- > 0) {
        x += dx;
        y += dy;
        if (x < 1 || x >= COLNO || y < 0 || y >= ROWNO) break;

        // Save the pile before the target is hit. A corpse made by this hit
        // must not rise again from the same beam.
        const floorObjects = [...(state.level?.objects?.[x]?.[y] || [])];
        const monster = monsterAt(x, y, state);
        if (monster) {
            await turnMonster(monster, source, state, options);
            range -= 3;
        }

        let pileAffected = false;
        for (const object of floorObjects) {
            if (await turnObject(object, state)) pileAffected = true;
        }
        if (pileAffected) range--;
        if (!rayCellIsOpen(x, y, state)) break;
    }
    return true;
}
