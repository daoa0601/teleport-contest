// Monster petrification and the statue left behind.
// C refs: trap.c minstapetrify(), mon.c mon_to_stone() and monstone().

import { G_GENOD, W_ARM, W_ARMC, W_ARMU } from './const.js';
import {
    canSeeMonster, newsym, plineWithContinuation,
} from './display.js';
import { recordHeroKillConduct } from './end.js';
import { game } from './gstate.js';
import { endObjectBurn } from './light.js';
import {
    lifeSaveMonster, wornMonsterLifeSaver,
} from './mondeath.js';
import { clearMonsterCarriedObjectState } from './monster_inventory.js';
import {
    mkcorpstat, mksobj, place_object, shapechangeMonster, stack_object,
} from './mklev.js';
import {
    MONSTER_GENO, MONSTER_RESISTS, MONSTER_SIZE, MONSTER_SYMBOL,
    monsterTypeName,
} from './monster_data.js';
import { BOULDER, ROCK, STATUE } from './object_data.js';
import { objectResistsDestruction } from './object_state.js';
import { rn2 } from './rng.js';
import { cansee } from './vision.js';
import { objectWeight } from './weight.js';

const MR_STONE = 0x80;
const S_GOLEM = 55;
const PM_STONE_GOLEM = 257;
const G_UNIQ = 0x1000;
const VAMPIRE_FORMS = new Set([226, 227, 228]);
const TORSO_ARMOR = W_ARM | W_ARMC | W_ARMU;

function speciesWasGenocided(mnum) {
    return !!((game.mvitals?.[mnum]?.mvflags ?? 0) & G_GENOD);
}

function monsterSubject(monster) {
    if (monster.name) return monster.name;
    return `The ${monsterTypeName(monster.mnum, !!monster.female)}`;
}

export function monsterWearsTorsoArmor(monster) {
    return (monster?.minvent || monster?.inventory || []).some(object =>
        ((object.owornmask ?? 0) & TORSO_ARMOR) !== 0);
}

export function monsterResistsStoning(monster) {
    const resistance = (MONSTER_RESISTS[monster?.mnum] ?? 0)
        | (monster?.mextrinsics ?? 0)
        | (monster?.mintrinsics ?? 0);
    return !!(resistance & MR_STONE);
}

async function turnGolemToStone(monster) {
    if (MONSTER_SYMBOL[monster.mnum] !== S_GOLEM
        || monster.mnum === PM_STONE_GOLEM
        || speciesWasGenocided(PM_STONE_GOLEM)) return false;

    const visible = canSeeMonster(monster, monster.mx, monster.my);
    if (visible) {
        await plineWithContinuation(
            `${monsterSubject(monster)} solidifies...`,
        );
    }
    const changed = shapechangeMonster(monster, PM_STONE_GOLEM);
    if (visible) {
        await plineWithContinuation(changed
            ? `Now it's a ${monsterTypeName(monster.mnum)}.`
            : '... and returns to normal.');
    }
    if (changed) newsym(monster.mx, monster.my);
    return true;
}

async function restoreShapechanger(monster) {
    const baseForm = monster?.cham;
    if (!Number.isInteger(baseForm) || baseForm < 0
        || baseForm === monster.mnum || speciesWasGenocided(baseForm)) {
        return false;
    }
    const vampire = VAMPIRE_FORMS.has(baseForm);
    const resistantBase = !!((MONSTER_RESISTS[baseForm] ?? 0) & MR_STONE);
    if (!vampire && !resistantBase) return false;

    const oldName = monsterTypeName(monster.mnum, !!monster.female);
    monster.mcanmove = 1;
    monster.mfrozen = 0;
    monster.mhpmax = Math.max(
        monster.mhpmax ?? 1, (monster.m_lev ?? 0) + 1, 10,
    );
    monster.mhp = monster.mhpmax;
    if (!shapechangeMonster(monster, baseForm)) return false;
    monster.cham = -1;
    if (canSeeMonster(monster, monster.mx, monster.my)) {
        const subject = vampire
            ? `The lapidifying ${oldName}` : `The ${oldName}`;
        await plineWithContinuation(
            `${subject} turns into ${monsterTypeName(baseForm)}!`,
        );
    }
    newsym(monster.mx, monster.my);
    return true;
}

function putInStatue(statue, object) {
    clearMonsterCarriedObjectState(object);
    endObjectBurn(object);
    object.where = 'contained';
    object.container = statue;
    object.ox = 0;
    object.oy = 0;
    statue.contents ||= [];
    statue.contents.unshift(object);
}

function dropBesideStatue(object, x, y) {
    clearMonsterCarriedObjectState(object);
    place_object(object, x, y);
    return stack_object(object, game);
}

function statueFlags(monster) {
    let flags = monster.female ? 0x02 : 0x01;
    if ((MONSTER_GENO[monster.mnum] ?? 0) & G_UNIQ) flags |= 0x04;
    return flags;
}

function createStoneRemains(monster) {
    const x = monster.mx;
    const y = monster.my;
    const frequency = (MONSTER_GENO[monster.mnum] ?? 0) & 0x07;
    const leavesStatue = (MONSTER_SIZE[monster.mnum] ?? 0) > 0
        || rn2(2 + Number(frequency > 2)) === 0;
    if (!leavesStatue) {
        const rock = mksobj(ROCK, true, false);
        place_object(rock, x, y);
        return stack_object(rock, game);
    }

    const contained = [];
    for (const object of monster.minvent || monster.inventory || []) {
        if (object.otyp === BOULDER
            || objectResistsDestruction(object, 0, 0)) {
            dropBesideStatue(object, x, y);
        } else {
            contained.push(object);
        }
    }
    monster.minvent = [];
    monster.inventory = monster.minvent;
    monster.hasInventory = false;
    monster.mw = null;
    monster.misc_worn_check = 0;

    const statue = mkcorpstat(
        STATUE, monster, monster.mnum, x, y, statueFlags(monster),
    );
    if (monster.name) statue.oname = monster.name;
    for (const object of contained) putInStatue(statue, object);
    statue.owt = objectWeight(statue);
    return stack_object(statue, game);
}

export async function petrifyMonster(monster, {
    creditHero = false,
    finishDeath,
} = {}) {
    if (!monster || monster.dead || (monster.mhp ?? 1) <= 0)
        return { changed: false, survived: false };
    if (monsterResistsStoning(monster))
        return { changed: false, survived: true };
    if (await turnGolemToStone(monster))
        return { changed: true, survived: true };
    if (await restoreShapechanger(monster))
        return { changed: true, survived: true };

    monster.mspeed = 0;
    monster.fast = false;
    if (cansee(monster.mx, monster.my)) {
        await plineWithContinuation(
            `${monsterSubject(monster)} turns to stone.`,
        );
    }
    if (creditHero) recordHeroKillConduct();

    monster.mhp = 0;
    const lifeSaver = wornMonsterLifeSaver(monster);
    if (lifeSaver) {
        await lifeSaveMonster(monster, lifeSaver, {
            visible: cansee(monster.mx, monster.my),
            spotted: canSeeMonster(monster, monster.mx, monster.my),
        });
        if ((monster.mhp ?? 0) > 0)
            return { changed: true, survived: true };
    }

    if (typeof finishDeath !== 'function')
        throw new TypeError('petrifyMonster requires a death function');
    monster.mtrapped = 0;
    const remains = createStoneRemains(monster);
    await finishDeath(monster);
    newsym(monster.mx, monster.my);
    return { changed: true, survived: false, remains };
}
