// Monster petrification and the statue left behind.
// C refs: trap.c minstapetrify(), mon.c mon_to_stone() and monstone().

import {
    G_GENOD, W_ARM, W_ARMC, W_ARMG, W_ARMU,
} from './const.js';
import {
    canSeeMonster, newsym, plineWithContinuation,
} from './display.js';
import { recordHeroKillConduct } from './end.js';
import { game } from './gstate.js';
import { endObjectBurn } from './light.js';
import { addObjectToContainer } from './object_container.js';
import { place_object, stack_object } from './floor_object.js';
import { landFloorObject } from './floor_effects.js';
import {
    lifeSaveMonster, wornMonsterLifeSaver,
} from './mondeath.js';
import {
    clearMonsterCarriedObjectState, removeObjectFromMonsterInventory,
} from './monster_inventory.js';
import { applyMonsterEquipmentProperties } from './monster_equipment.js';
import {
    monsterWieldedWeapon, unwieldMonsterWeapon,
} from './monster_weapon.js';
import { mkcorpstat, mksobj } from './mklev.js';
import {
    MONSTER_FLAGS2, MONSTER_GENO, MONSTER_SIZE, MONSTER_SYMBOL, monsterTypeName,
} from './monster_data.js';
import { changeMonsterForm } from './monster_polymorph.js';
import { BOULDER, CORPSE, ROCK, STATUE } from './object_data.js';
import { objectResistsDestruction } from './object_state.js';
import { monsterHasStoneResistance } from './monster_resistance.js';
import { adjustMonsterSpeed, monsterSpeedMessage } from './monster_speed.js';
import { useMonsterStoningCure } from './monster_stoning_cure.js';
import { rn2, rnd } from './rng.js';
import { touchPetrifies } from './stoning.js';
import { cansee } from './vision.js';
import { objectWeight } from './weight.js';

const S_GOLEM = 55;
const PM_STONE_GOLEM = 257;
const G_UNIQ = 0x1000;
const M2_NEUTER = 0x00040000;
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

function monsterWearsGloves(monster) {
    return !!((monster?.misc_worn_check ?? 0) & W_ARMG)
        || (monster?.minvent || monster?.inventory || []).some(object =>
            ((object.owornmask ?? 0) & W_ARMG) !== 0);
}

function selfTouchSubject(monster, prefix) {
    const subject = monsterSubject(monster);
    if (!prefix || monster.name) return subject;
    return subject.charAt(0).toLowerCase() + subject.slice(1);
}

// C trap.c:mselftouch(). Falling can force contact even through gloves;
// newcham() only calls this after the new body has lost its gloves.
export async function monsterSelfTouch(monster, {
    prefix = '',
    creditHero = false,
    finishDeath,
    publish = plineWithContinuation,
    state = game,
} = {}) {
    const corpse = monsterWieldedWeapon(monster);
    if (!corpse || corpse.otyp !== CORPSE
        || !touchPetrifies(corpse.corpsenm)
        || monsterHasStoneResistance(monster)) {
        return { touched: false, survived: true };
    }

    if (cansee(monster.mx, monster.my)) {
        await publish(
            `${prefix}${selfTouchSubject(monster, prefix)} touches the ${
                monsterTypeName(corpse.corpsenm)
            } corpse.`,
        );
    }
    const petrification = await petrifyMonsterImmediately(monster, {
        creditHero, finishDeath, publish,
    });
    if (petrification.survived && !monsterWearsGloves(monster)
        && !monsterHasStoneResistance(monster)) {
        await unwieldMonsterWeapon(monster, state, { publish });
    }
    return { touched: true, corpse, ...petrification };
}

export async function monsterSelfTouchAfterPolymorph(monster, options = {}) {
    if (monsterWearsGloves(monster))
        return { touched: false, survived: true };
    return monsterSelfTouch(monster, {
        ...options,
        prefix: 'No longer petrify-resistant, ',
    });
}

export async function petrifyMonsterFromContact(monster, {
    creditHero = false,
    finishDeath,
    publish = plineWithContinuation,
    rollOne = rnd,
    state = game,
} = {}) {
    const cure = await useMonsterStoningCure(monster, {
        finishDeath, publish, rollOne, state,
    });
    if (cure.consumed) {
        return {
            changed: true,
            survived: !cure.died,
            cured: !cure.died,
            cure,
        };
    }
    return petrifyMonsterImmediately(monster, {
        creditHero, finishDeath, publish,
    });
}

// C mhitm.c:mdamagem(). Touching the defender leaves no time to eat a cure.
export async function petrifyMonsterAttacker(monster, {
    publish = plineWithContinuation,
    visible = canSeeMonster(monster, monster.mx, monster.my),
    ...options
} = {}) {
    if (await turnGolemToStone(monster, publish)) return { survived: true };
    if (visible) await publish(`${monsterSubject(monster)} turns to stone!`);
    return finishMonsterPetrification(monster, { ...options, publish });
}

// C uhitm.c:do_stone_mon(). A cure or life saving ends this hit.
export async function petrifyMonsterDefender(monster, {
    publish = plineWithContinuation,
    visible = canSeeMonster(monster, monster.mx, monster.my),
    ...options
} = {}) {
    const cure = await useMonsterStoningCure(monster, { ...options, publish });
    if (cure.consumed)
        return { survived: !cure.died, stopped: true, damage: 0, cure };
    if (await turnGolemToStone(monster, publish))
        return { survived: true, stopped: false, damage: 0 };
    if (monsterHasStoneResistance(monster))
        return { survived: true, stopped: false, damage: 1 };
    if (visible) await publish(`${monsterSubject(monster)} turns to stone!`);
    const result = await finishMonsterPetrification(monster, { ...options, publish });
    return { ...result, stopped: true, damage: 0 };
}

async function turnGolemToStone(monster, publish) {
    if (MONSTER_SYMBOL[monster.mnum] !== S_GOLEM
        || monster.mnum === PM_STONE_GOLEM
        || speciesWasGenocided(PM_STONE_GOLEM)) return false;

    const visible = canSeeMonster(monster, monster.mx, monster.my);
    if (visible) {
        await publish(
            `${monsterSubject(monster)} solidifies...`,
        );
    }
    const changed = !!await changeMonsterForm(monster, PM_STONE_GOLEM);
    if (visible) {
        await publish(changed
            ? `Now it's a ${monsterTypeName(monster.mnum)}.`
            : '... and returns to normal.');
    }
    if (changed) newsym(monster.mx, monster.my);
    return true;
}

async function restoreShapechanger(monster, publish) {
    const baseForm = monster?.cham;
    if (!Number.isInteger(baseForm) || baseForm < 0
        || baseForm === monster.mnum || speciesWasGenocided(baseForm)) {
        return false;
    }
    const vampire = VAMPIRE_FORMS.has(baseForm);
    const resistantBase = monsterHasStoneResistance({ mnum: baseForm });
    if (!vampire && !resistantBase) return false;

    const oldName = monsterTypeName(monster.mnum, !!monster.female);
    monster.mcanmove = 1;
    monster.mfrozen = 0;
    monster.mhpmax = Math.max(
        monster.mhpmax ?? 1, (monster.m_lev ?? 0) + 1, 10,
    );
    monster.mhp = monster.mhpmax;
    if (!await changeMonsterForm(monster, baseForm)) return false;
    monster.cham = -1;
    if (canSeeMonster(monster, monster.mx, monster.my)) {
        const subject = vampire
            ? `The lapidifying ${oldName}` : `The ${oldName}`;
        await publish(
            `${subject} turns into ${monsterTypeName(baseForm)}!`,
        );
    }
    newsym(monster.mx, monster.my);
    return true;
}

function putInStatue(statue, object) {
    clearMonsterCarriedObjectState(object);
    endObjectBurn(object);
    addObjectToContainer(statue, object);
}

async function dropBesideStatue(object, x, y, publish) {
    clearMonsterCarriedObjectState(object);
    return landFloorObject(object, x, y, { state: game, publish });
}

function statueFlags(monster) {
    let flags = monster.female ? 0x02
        : MONSTER_FLAGS2[monster.mnum] & M2_NEUTER ? 0 : 0x01;
    if ((MONSTER_GENO[monster.mnum] ?? 0) & G_UNIQ) flags |= 0x04;
    return flags;
}

async function createStoneRemains(monster, publish) {
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
    for (const object of [...(monster.minvent || [])]) {
        const worn = object.owornmask;
        await removeObjectFromMonsterInventory(monster, object, game, {
            publish: async () => {},
        });
        // monstone saves traits only after removing item-granted properties.
        if (worn) applyMonsterEquipmentProperties(monster, object, false);
        if (object.otyp === BOULDER
            || objectResistsDestruction(object, 0, 0)) {
            await dropBesideStatue(object, x, y, publish);
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

export async function petrifyMonsterImmediately(monster, {
    creditHero = false,
    finishDeath,
    publish = plineWithContinuation,
} = {}) {
    if (!monster || monster.dead || (monster.mhp ?? 1) <= 0)
        return { changed: false, survived: false };
    if (monsterHasStoneResistance(monster))
        return { changed: false, survived: true };
    if (await turnGolemToStone(monster, publish))
        return { changed: true, survived: true };
    if (await restoreShapechanger(monster, publish))
        return { changed: true, survived: true };

    const speed = adjustMonsterSpeed(monster, -3);
    const speedMessage = game.flags?.verbose === false
        ? null : monsterSpeedMessage(speed, monsterSubject(monster));
    if (cansee(monster.mx, monster.my) && speedMessage)
        await publish(speedMessage);
    if (cansee(monster.mx, monster.my)) {
        await publish(
            `${monsterSubject(monster)} turns to stone.`,
        );
    }
    if (creditHero) recordHeroKillConduct();

    return finishMonsterPetrification(monster, { finishDeath, publish });
}

// C mon.c:monstone(). Reversion and life saving precede statue creation.
async function finishMonsterPetrification(monster, {
    finishDeath,
    publish = plineWithContinuation,
} = {}) {
    if (await restoreShapechanger(monster, publish))
        return { changed: true, survived: true };

    monster.mhp = 0;
    const lifeSaver = wornMonsterLifeSaver(monster);
    if (lifeSaver) {
        await lifeSaveMonster(monster, lifeSaver, {
            visible: cansee(monster.mx, monster.my),
            spotted: canSeeMonster(monster, monster.mx, monster.my),
            publish,
        });
        if ((monster.mhp ?? 0) > 0)
            return { changed: true, survived: true };
    }

    if (typeof finishDeath !== 'function')
        throw new TypeError('petrifyMonster requires a death function');
    monster.mtrapped = 0;
    const remains = await createStoneRemains(monster, publish);
    await finishDeath(monster, { noCorpse: true });
    newsym(monster.mx, monster.my);
    return { changed: true, survived: false, remains };
}
