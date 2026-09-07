// Explosions produced by a monster dying.
// C refs: mon.c corpse_chance() and explode.c mon_explodes()/explode().

import { exerciseAttribute } from './attrib.js';
import { A_STR, COLNO, ROWNO, Upolyd } from './const.js';
import {
    canProjectMonster, flush_screen, newsym, plineWithContinuation,
    show_glyph_cell,
} from './display.js';
import { finishHeroDeath } from './end.js';
import { game } from './gstate.js';
import { angerAttackedMonster } from './monster_anger.js';
import { AT_BOOM } from './monster_attack_types.js';
import {
    MONSTER_ATTACKS, MONSTER_LEVEL, monsterIsNonliving, monsterTypeName,
} from './monster_data.js';
import { monsterResistsEffect } from './monster_resistance.js';
import { wakeMonstersNear } from './monster_wake.js';
import {
    heroFormSticks, returnHeroToHumanForm,
} from './polyself.js';
import { d, rn2 } from './rng.js';
import { heroIsBlind, heroIsDeaf } from './senses.js';
import { CLR_GREEN } from './terminal.js';
import { cansee } from './vision.js';

function insideBlast(targetX, targetY, x, y) {
    return Math.abs(targetX - x) <= 1 && Math.abs(targetY - y) <= 1;
}

function blastCells(x, y) {
    const cells = [];
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            const targetX = x + dx;
            const targetY = y + dy;
            if (targetX < 1 || targetX >= COLNO
                || targetY < 0 || targetY >= ROWNO) continue;
            cells.push({ x: targetX, y: targetY });
        }
    }
    return cells;
}

function squareIsVisible(state, x, y) {
    if (state === game) return cansee(x, y);
    if (heroIsBlind(state)) return false;
    return !state.viz_array || !!(state.viz_array?.[y]?.[x] & 0x2);
}

async function showPhysicalExplosion(x, y, state) {
    const cells = blastCells(x, y);
    const visible = cells.some(cell => squareIsVisible(
        state, cell.x, cell.y,
    ));
    if (!visible || state !== game) return visible;

    const mask = [
        ['/', false], ['o', true], ['\\', false],
        ['x', true], [' ', false], ['x', true],
        ['\\', false], ['s', true], ['/', false],
    ];
    try {
        for (const cell of cells) {
            const index = (cell.y - y + 1) * 3 + cell.x - x + 1;
            const [ch, decgfx] = mask[index];
            show_glyph_cell(cell.x, cell.y, ch, CLR_GREEN, decgfx);
        }
        await flush_screen(1);
        state.nhDisplay?.setCursor(
            (state.u?.ux ?? 1) - 1,
            (state.u?.uy ?? 0) + 1,
        );
        await state.animationFrame?.();
        await state.animationFrame?.();
    } finally {
        for (const cell of cells) newsym(cell.x, cell.y);
    }
    return true;
}

function rollAttackDamage(monster, attack, rollDice) {
    const [, , dice = 0, sides = 0] = attack;
    if (dice > 0) return rollDice(dice, sides);
    if (sides > 0) {
        const level = monster.m_lev
            ?? MONSTER_LEVEL[monster.mnum]
            ?? 0;
        return rollDice(level + 1, sides);
    }
    return 0;
}

export function monsterHasDeathExplosion(monster) {
    return (MONSTER_ATTACKS[monster?.mnum] || [])
        .some(attack => attack[0] === AT_BOOM);
}

export function rollMonsterDeathExplosionDamage(monster, rollDice = d) {
    const attack = (MONSTER_ATTACKS[monster?.mnum] || [])
        .find(candidate => candidate[0] === AT_BOOM);
    if (!attack) return null;

    // corpse_chance() rolls once, then mon_explodes() rolls the blast again.
    rollAttackDamage(monster, attack, rollDice);
    return rollAttackDamage(monster, attack, rollDice);
}

function monsterAt(state, x, y) {
    const monster = state.level?.monsters?.find(candidate =>
        !candidate.dead && (candidate.mhp ?? 1) > 0
        && candidate.mx === x && candidate.my === y);
    if (monster) return monster;
    const steed = state.u?.usteed;
    if (state.u?.ux === x && state.u?.uy === y
        && steed && !steed.dead && (steed.mhp ?? 1) > 0) return steed;
    return null;
}

function monsterSubject(monster) {
    return monster.name
        || `The ${monsterTypeName(monster.mnum, !!monster.female)}`;
}

function monsterDeathMessage(monster) {
    const verb = monsterIsNonliving(monster.mnum) ? 'destroyed' : 'killed';
    return `${monsterSubject(monster)} is ${verb}!`;
}

function consumePhysicalInventoryRoll(damage, random) {
    const remainder = damage % 5;
    const limit = Math.trunc(damage / 5)
        + Number(remainder > random(5));
    return Math.min(20, Math.max(0, limit));
}

function monsterIsSpotted(monster, state) {
    if (state === game) {
        return canProjectMonster(monster, monster.mx, monster.my);
    }
    const seesInvisible = state.u?.seeInvisible || state.u?.see_invisible;
    return squareIsVisible(state, monster.mx, monster.my)
        && !monster.mundetected && (!monster.minvis || seesInvisible);
}

async function damageMonster(
    monster, x, y, damage, sourceName, {
        state, heroCaused, publish, random,
        finishMonsterDeath, angerMonster,
    },
) {
    const visible = squareIsVisible(state, monster.mx, monster.my);
    const subject = monsterSubject(monster);
    if (visible)
        await publish(`${subject} is caught in the ${sourceName}!`);

    consumePhysicalInventoryRoll(damage, random);
    let appliedDamage = damage;
    const attackLevel = state.u?.ulevel ?? 1;
    if (monsterResistsEffect(monster, attackLevel, random)) {
        appliedDamage = Math.ceil(damage / 2);
        if (visible)
            await publish(`${subject} resists the ${sourceName}!`);
    }

    const heroIsHeld = state.u?.ustuck === monster
        && !state.u?.uswallow && !heroFormSticks(state);
    if (heroIsHeld && insideBlast(state.u.ux, state.u.uy, x, y))
        appliedDamage *= 2;
    monster.mhp = Math.max(0, (monster.mhp ?? 1) - appliedDamage);
    if (monster.mhp <= 0) {
        if (typeof finishMonsterDeath !== 'function') {
            throw new TypeError(
                'lethal monster explosion requires a monster death handler',
            );
        }
        await finishMonsterDeath(monster, {
            x: monster.mx,
            y: monster.my,
            deathMessage: visible ? monsterDeathMessage(monster) : null,
            visible,
            spotted: monsterIsSpotted(monster, state),
            random,
            publish,
        });
    } else if (heroCaused) {
        await angerMonster(monster);
    }
}

async function damageHero(x, y, damage, sourceName, {
    state, publish, random, finishHero,
}) {
    const hero = state.u;
    if (!insideBlast(hero.ux, hero.uy, x, y)) return;
    if (state.flags?.verbose !== false)
        await publish(`You are caught in the ${sourceName}!`);

    consumePhysicalInventoryRoll(damage, random);
    let appliedDamage = damage;
    if (hero.uinvulnerable || hero.invulnerable
        || (hero.invulnerableTurns ?? 0) > 0) {
        appliedDamage = 0;
        await publish('You are unharmed!');
    } else if (hero.halfPhysicalDamage || hero.half_physical_damage) {
        appliedDamage = Math.ceil(appliedDamage / 2);
    }

    const heroIsGrabbing = hero.ustuck && !hero.uswallow
        && heroFormSticks(state);
    if (heroIsGrabbing
        && insideBlast(hero.ustuck.mx, hero.ustuck.my, x, y)) {
        appliedDamage *= 2;
    }
    const hitPoints = Upolyd(hero) ? 'mh' : 'uhp';
    hero[hitPoints] = Math.max(0, (hero[hitPoints] ?? 1) - appliedDamage);
    if (hero[hitPoints] <= 0) {
        if (Upolyd(hero))
            await returnHeroToHumanForm(state, { publish, die: finishHero });
        else await finishHero({ killer: sourceName });
    }
    exerciseAttribute(A_STR, false, state);
}

export async function createPhysicalMonsterExplosion(
    sourceMonster, x, y, damage, {
        state = game,
        heroCaused = false,
        publish = plineWithContinuation,
        random = rn2,
        finishMonsterDeath = null,
        finishHero = finishHeroDeath,
        angerMonster = angerAttackedMonster,
    } = {},
) {
    const species = monsterTypeName(
        sourceMonster.mnum, !!sourceMonster.female,
    );
    const possessive = /s$/i.test(species) ? `${species}'` : `${species}'s`;
    const sourceName = `${possessive} explosion`;
    const visible = await showPhysicalExplosion(x, y, state);
    const deaf = state.deaf || state.u?.deaf || heroIsDeaf(state);
    if (!deaf) {
        await publish(visible ? 'Boom!' : 'You hear a blast.');
    }

    if (damage > 0) {
        for (const cell of blastCells(x, y)) {
            const monster = monsterAt(state, cell.x, cell.y);
            if (!monster) continue;
            await damageMonster(monster, x, y, damage, sourceName, {
                state, heroCaused, publish, random,
                finishMonsterDeath, angerMonster,
            });
        }
        await damageHero(x, y, damage, sourceName, {
            state, publish, random, finishHero,
        });
    }

    wakeMonstersNear(x, y, Math.max(50, damage * damage), state);
}
