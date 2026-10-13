// Statue traps and the monster released from their statue.
// C refs: trap.c animate_statue() and activate_statue_trap().
import { heroIsHallucinating } from './senses.js';
import { deleteTrap } from './trap_lifecycle.js';
import { setMonsterGivenName } from './monster_given_name.js';
import { adjustHeroAlignment } from './alignment.js';
import { CORPSTAT_HISTORIC, MM_ADJACENTOK, MM_NOCOUNTBIRTH, MM_NOMSG, MM_NOTAIL, MM_NOWAIT, NO_MINVENT, STATUE_TRAP, } from './const.js';
import { canSpotMonster, newsym, plineWithContinuation as pline, randomDisplayMonsterName, } from './display.js';
import { makePetWary } from './dog.js';
import { delobj } from './object_delete.js';
import { removeWornHeroItem } from './hero_equipment.js';
import { costlySpot } from './shk.js';
import { stolenValue } from './shop_loss.js';
import { game, requireGameLevel } from './gstate.js';
import { makemonAt, makemonNear } from './mklev.js';
import { setMonsterMalign } from './monster_alignment.js';
import { MONSTER_GENO, MONSTER_NAME, MONSTER_SOUND, MONSTER_SYMBOL, monsterIsNonliving, monsterIsVampireShifter, monsterTypeName, } from './monster_data.js';
import { addObjectToMonsterInventory } from './monster_inventory.js';
import { changeMonsterForm, restoreMonsterShape } from './monster_polymorph.js';
import { monsterAtPosition } from './monster_location.js';
import { restoreMonsterTraits } from './monster_traits.js';
import { initializeMonsterArmor } from './monworn.js';
import { STATUE } from './object_data.js';
import { heroFormHidesUnderObjects } from './polyself.js';
import { markQuestLeaderAlive } from './quest.js';
import { bodyGenderFlags, PM_DOPPELGANGER, revivalReplacement, } from './revival_species.js';
import { cansee } from './vision.js';
function requireStatueSpecies(statue) {
    if (statue.corpsenm === undefined)
        throw new Error(`Statue ${statue.o_id} has no monster species.`);
}
const G_UNIQ = 0x1000;
const MS_GUARDIAN = 38;
const PM_FLESH_GOLEM = MONSTER_NAME.indexOf('flesh golem');
const S_GOLEM = MONSTER_SYMBOL[PM_FLESH_GOLEM];
function statueReplacement(statue, state) {
    const replacement = revivalReplacement(statue.corpsenm, statue, false);
    if (replacement != null)
        return replacement;
    if ((MONSTER_SOUND[statue.corpsenm] ?? 0) === MS_GUARDIAN
        && state.urole?.guardnum !== statue.corpsenm) {
        return PM_DOPPELGANGER;
    }
    return null;
}
async function createStatueMonster(statue, x, y, state, magic) {
    const savedTraits = statue.oextra?.omonst;
    const replacement = statueReplacement(statue, state)
        ?? (magic && MONSTER_SYMBOL[statue.corpsenm] === S_GOLEM
            && statue.corpsenm !== PM_FLESH_GOLEM ? PM_FLESH_GOLEM : null);
    const useSavedTraits = replacement == null && !!savedTraits;
    const mnum = replacement ?? savedTraits?.mnum ?? statue.corpsenm;
    let flags = NO_MINVENT | MM_NOMSG;
    if (useSavedTraits) {
        flags |= MM_NOWAIT | MM_NOCOUNTBIRTH | MM_NOTAIL;
    }
    else {
        flags |= bodyGenderFlags(statue);
    }
    const mayMoveAside = magic || replacement === PM_DOPPELGANGER;
    if (mayMoveAside)
        flags |= MM_ADJACENTOK;
    if (replacement === PM_DOPPELGANGER)
        flags |= MM_NOCOUNTBIRTH;
    const heroAtStatue = state.u?.ux === x && state.u?.uy === y;
    const occupied = !!monsterAtPosition(requireGameLevel(state), x, y);
    const monster = heroAtStatue || (occupied && mayMoveAside)
        ? await makemonNear(mnum, x, y, flags, heroAtStatue)
        : await makemonAt(mnum, x, y, flags);
    if (!monster)
        return null;
    if (useSavedTraits) {
        restoreMonsterTraits(monster, savedTraits);
        markQuestLeaderAlive(monster, state);
        newsym(monster.mx, monster.my);
        await restoreMonsterShape(monster, state);
        if (monster.mtame && !monster.isminion)
            makePetWary(monster, { wasDead: true, state });
    }
    else if (replacement === PM_DOPPELGANGER
        && monster.cham === PM_DOPPELGANGER) {
        await changeMonsterForm(monster, statue.corpsenm);
    }
    return monster;
}
function statueDescription(statue, article) {
    const female = ((statue.spe ?? 0) & 0x03) === 1;
    const species = monsterTypeName(statue.corpsenm, female);
    const name = statue.oextra?.oname || statue.oname;
    return `${article} statue of ${species}${name ? ` named ${name}` : ''}`;
}
function animationVerb(monster) {
    if (!canSpotMonster(monster))
        return 'disappears';
    if (monsterIsNonliving(monster.mnum)
        || monsterIsVampireShifter(monster))
        return 'moves';
    return 'comes to life';
}
async function describeAnimation(statue, monster, x, y, state, shatter, magic) {
    const verb = magic && MONSTER_SYMBOL[statue.corpsenm] === S_GOLEM
        && statue.corpsenm !== PM_FLESH_GOLEM && canSpotMonster(monster)
        ? 'turns into flesh' : animationVerb(monster);
    const heroAtStatue = state.u?.ux === x && state.u?.uy === y;
    if (heroAtStatue || magic) {
        await pline(`${statueDescription(statue, 'The')} ${verb}!`);
        return;
    }
    if (heroIsHallucinating(state)) {
        await pline(`The ${randomDisplayMonsterName()} suddenly seems more animated.`);
        return;
    }
    if (shatter) {
        const description = cansee(x, y)
            ? statueDescription(statue, 'the') : 'a statue';
        await pline(`Instead of shattering, ${description} suddenly ${verb}!`);
        return;
    }
    const description = canSpotMonster(monster)
        ? `a ${monsterTypeName(monster.mnum, !!monster.female)}`
        : 'something';
    await pline(`You find ${description} posing as a statue.`);
}
function nameReleasedMonster(monster, statue) {
    const name = statue.oextra?.oname || statue.oname;
    if (!name || ((MONSTER_GENO[monster.mnum] ?? 0) & G_UNIQ))
        return;
    setMonsterGivenName(monster, name);
}
async function transferStatueContents(statue, monster, state) {
    while (statue.contents?.length) {
        const object = statue.contents.shift();
        if (!object)
            throw new Error('Statue contents changed during transfer.');
        object.where = 'free';
        object.container = null;
        await addObjectToMonsterInventory(monster, object, state);
    }
    await initializeMonsterArmor(monster, state);
}
function revealHeroWithoutCover(x, y, state) {
    if (state.u?.ux !== x || state.u?.uy !== y)
        return;
    const pile = state.level?.objects?.[x]?.[y] || [];
    if (state.u.uundetected && heroFormHidesUnderObjects(state)
        && pile.length === 0)
        state.u.uundetected = 0;
}
export async function animateStatue(statue, x, y, { state = game, shatter = false, magic = false, } = {}) {
    requireStatueSpecies(statue);
    const monster = await createStatueMonster(statue, x, y, state, magic);
    if (!monster) {
        const unique = !!((MONSTER_GENO[statue.corpsenm] ?? 0) & G_UNIQ);
        return { monster: null, unique };
    }
    nameReleasedMonster(monster, statue);
    monster.m_ap_type = 0;
    monster.mappearance = 0;
    monster.mundetected = 0;
    monster.msleeping = 0;
    if (!magic) {
        monster.mtame = 0;
        monster.pet = false;
        monster.mpeaceful = 0;
        setMonsterMalign(monster, state);
    }
    await describeAnimation(statue, monster, x, y, state, shatter, magic);
    const keeper = costlySpot(x, y, state)?.resident;
    if (!state.context?.mon_moving && (magic || shatter) && keeper !== monster
        && keeper && (statue.where === 'inventory' ? statue.unpaid : !statue.no_charge))
        await stolenValue(statue, x, y, !!keeper.mpeaceful, { silent: false, state });
    if (!state.context?.mon_moving
        && state.urole?.key === 'archeologist'
        && ((statue.spe ?? 0) & CORPSTAT_HISTORIC)) {
        await pline('You feel guilty that the historic statue is now gone.');
        adjustHeroAlignment(-1, state);
    }
    await transferStatueContents(statue, monster, state);
    if (statue.owornmask)
        await removeWornHeroItem(statue, state);
    await delobj(statue, state);
    revealHeroWithoutCover(x, y, state);
    return { monster, unique: false };
}
export async function activateStatueTrapAt(x, y, { state = game, shatter = false } = {}) {
    const trap = state.level?.traps?.find(candidate => candidate.tx === x && candidate.ty === y
        && candidate.ttyp === STATUE_TRAP);
    if (!trap)
        return null;
    deleteTrap(trap, state);
    const statues = (state.level?.objects?.[x]?.[y] || [])
        .filter(object => object.otyp === STATUE);
    let monster = null;
    for (const statue of statues) {
        const result = await animateStatue(statue, x, y, { state, shatter });
        monster = result.monster;
        if (monster || !result.unique)
            break;
    }
    newsym(x, y);
    return monster;
}
//# sourceMappingURL=statue_trap.js.map