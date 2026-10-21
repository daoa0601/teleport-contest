// Monster petrification and the statue left behind.
// C refs: trap.c minstapetrify(), mon.c mon_to_stone() and monstone().
import { CORPSTAT_FEMALE, CORPSTAT_HISTORIC, CORPSTAT_MALE, D_CLOSED, D_LOCKED, DOOR, G_GENOD, W_ARM, W_ARMC, W_ARMG, W_ARMU, engulfing_u, } from './const.js';
import { canSeeMonster, canSpotMonster, displayMessageWindow, newsym, plineWithContinuation, unmap_invisible, } from './display.js';
import { expelHero } from './hero_expulsion.js';
import { relocateMonsterTo } from './teleport.js';
import { findNearbyMonsterPosition } from './teleport_rules.js';
import { surfaceName } from './terrain_name.js';
import { recordHeroKillConduct } from './end.js';
import { game } from './gstate.js';
import { endObjectBurn } from './light.js';
import { addObjectToContainer } from './object_container.js';
import { placeCreatedObject, stack_object } from './floor_object.js';
import { landFloorObject } from './floor_effects.js';
import { lifeSaveMonster, wornMonsterLifeSaver, } from './mondeath.js';
import { clearMonsterCarriedObjectState, removeObjectFromMonsterInventory, } from './monster_inventory.js';
import { applyMonsterEquipmentProperties } from './monster_equipment.js';
import { monsterName } from './monster_name.js';
import { monsterWieldedWeapon, unwieldMonsterWeapon, } from './monster_weapon.js';
import { mkcorpstat, mksobj } from './mklev.js';
import { MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_GENO, MONSTER_SIZE, MONSTER_SYMBOL, monsterIsAmorphous, monsterTypeName, } from './monster_data.js';
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
    return monsterName(monster, { capitalized: true });
}
export function monsterWearsTorsoArmor(monster) {
    return (monster?.minvent || monster?.inventory || []).some(object => ((object.owornmask ?? 0) & TORSO_ARMOR) !== 0);
}
function monsterWearsGloves(monster) {
    return !!((monster?.misc_worn_check ?? 0) & W_ARMG)
        || (monster?.minvent || monster?.inventory || []).some(object => ((object.owornmask ?? 0) & W_ARMG) !== 0);
}
function selfTouchSubject(monster, prefix) {
    const subject = monsterSubject(monster);
    if (!prefix || monster.name)
        return subject;
    return subject.charAt(0).toLowerCase() + subject.slice(1);
}
// C trap.c:mselftouch(). Falling can force contact even through gloves;
// newcham() only calls this after the new body has lost its gloves.
export async function monsterSelfTouch(monster, { prefix = '', creditHero = false, finishDeath, publish = plineWithContinuation, state = game, } = {}) {
    const corpse = monsterWieldedWeapon(monster);
    if (!corpse || corpse.otyp !== CORPSE || corpse.corpsenm === undefined
        || !touchPetrifies(corpse.corpsenm)
        || monsterHasStoneResistance(monster)) {
        return { touched: false, survived: true };
    }
    if (cansee(monster.mx, monster.my)) {
        await publish(`${prefix}${selfTouchSubject(monster, prefix)} touches the ${monsterTypeName(corpse.corpsenm)} corpse.`);
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
export async function petrifyMonsterFromContact(monster, { creditHero = false, finishDeath, publish = plineWithContinuation, rollOne = rnd, state = game, } = {}) {
    const cure = await useMonsterStoningCure(monster, {
        byHero: creditHero, publish, rollOne, state,
    });
    if (cure.consumed && cure.heroDied)
        return { heroDied: true };
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
export async function petrifyMonsterAttacker(monster, { publish = plineWithContinuation, visible = canSeeMonster(monster), creditHero = false, ...options } = {}) {
    const stoneForm = await turnGolemToStone(monster, publish);
    if (stoneForm?.heroDied)
        return { heroDied: true };
    if (stoneForm)
        return { survived: true };
    if (visible)
        await publish(`${monsterSubject(monster)} turns to stone!`);
    if (creditHero)
        recordHeroKillConduct();
    return finishMonsterPetrification(monster, { ...options, publish });
}
// C uhitm.c:do_stone_mon(). A cure or life saving ends this hit.
export async function petrifyMonsterDefender(monster, { publish = plineWithContinuation, visible = canSeeMonster(monster), ...options } = {}) {
    const cure = await useMonsterStoningCure(monster, { ...options, publish });
    if (cure.consumed && cure.heroDied)
        return { heroDied: true };
    if (cure.consumed)
        return { survived: !cure.died, stopped: true, damage: 0, cure };
    const stoneForm = await turnGolemToStone(monster, publish);
    if (stoneForm?.heroDied)
        return { heroDied: true };
    if (stoneForm)
        return { survived: true, stopped: false, damage: 0 };
    if (monsterHasStoneResistance(monster))
        return { survived: true, stopped: false, damage: 1 };
    if (visible)
        await publish(`${monsterSubject(monster)} turns to stone!`);
    const result = await finishMonsterPetrification(monster, { ...options, publish });
    return { ...result, stopped: true, damage: 0 };
}
// C mondata.c:poly_when_stoned(). Callers use this before fatal prose.
export function monsterPolymorphsWhenStoned(monster) {
    return MONSTER_SYMBOL[monster.mnum] === S_GOLEM
        && monster.mnum !== PM_STONE_GOLEM
        && !speciesWasGenocided(PM_STONE_GOLEM);
}
export async function turnGolemToStone(monster, publish) {
    if (!monsterPolymorphsWhenStoned(monster))
        return null;
    const visible = canSeeMonster(monster);
    if (visible) {
        await publish(`${monsterSubject(monster)} solidifies...`);
    }
    const change = await changeMonsterForm(monster, PM_STONE_GOLEM, game, { publish });
    if (change?.heroDied)
        return change;
    const changed = !!change;
    if (visible) {
        await publish(changed
            ? `Now it's a ${monsterTypeName(monster.mnum)}.`
            : '... and returns to normal.');
    }
    if (changed)
        newsym(monster.mx, monster.my);
    return { changed, heroDied: false };
}
async function restoreShapechanger(monster, publish) {
    const baseForm = monster?.cham;
    if (baseForm === undefined || !Number.isInteger(baseForm) || baseForm < 0
        || baseForm === monster.mnum || speciesWasGenocided(baseForm)) {
        return null;
    }
    if (VAMPIRE_FORMS.has(baseForm))
        return await reviveStonedVampire(monster, baseForm, publish);
    if (!monsterHasStoneResistance({ mnum: baseForm }))
        return null;
    const oldName = monsterTypeName(monster.mnum, !!monster.female);
    restoreRevertedMonsterHealth(monster);
    const change = await changeMonsterForm(monster, baseForm, game, { publish });
    if (!change || change.heroDied)
        return change;
    monster.cham = -1;
    if (canSeeMonster(monster)) {
        await publish(`The ${oldName} turns into ${monsterTypeName(baseForm)}!`);
    }
    newsym(monster.mx, monster.my);
    return { changed: true, heroDied: false };
}
function restoreRevertedMonsterHealth(monster) {
    monster.mcanmove = 1;
    monster.mfrozen = 0;
    // C mon.c:set_mon_min_mhpmax(mtmp, 10).
    monster.mhpmax = Math.max(monster.mhpmax ?? 1, (monster.m_lev ?? 0) + 1, 10);
    monster.mhp = monster.mhpmax;
}
const M1_FLY = 0x00000001;
// C mon.c:vamp_stone(): a shifted vampire falls in its current form, then
// silently resumes its vampire form and rises instead of petrifying.
async function reviveStonedVampire(monster, baseForm, publish) {
    const posture = monsterIsAmorphous(monster) ? 'coalesces on the'
        : (MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_FLY ? 'drops to the'
            : 'writhes on the';
    const fall = `The lapidifying ${monsterName(monster, {
        article: 'none', suppressSaddle: true, suppressHallucination: true,
        suppressInvisible: true, suppressIt: true,
    })} ${posture} ${surfaceName(monster.mx, monster.my)}`;
    restoreRevertedMonsterHealth(monster);
    if (engulfing_u(monster))
        await expelHero(monster, { message: false, publish });
    const location = game.level?.at(monster.mx, monster.my);
    if (monsterIsAmorphous(monster) && location?.typ === DOOR
        && (location.doormask ?? 0) & (D_CLOSED | D_LOCKED)) {
        const spot = findNearbyMonsterPosition(baseForm, monster.mx, monster.my);
        if (spot)
            await relocateMonsterTo(monster, spot.x, spot.y);
    }
    if (canSpotMonster(monster)) {
        await publish(`${fall}!`);
        await displayMessageWindow();
    }
    const change = await changeMonsterForm(monster, baseForm, game, { publish });
    if (change?.heroDied)
        return change;
    monster.cham = monster.mnum === baseForm ? -1 : baseForm;
    if (canSpotMonster(monster)) {
        await publish(`${monsterName(monster, { article: 'a', capitalized: true })} rises from the ${surfaceName(monster.mx, monster.my)} with renewed agility!`);
    }
    newsym(monster.mx, monster.my);
    return { changed: true, heroDied: false };
}
async function putInStatue(statue, object) {
    clearMonsterCarriedObjectState(object);
    endObjectBurn(object);
    // Arbitrary saved monster inventory: the general container owner
    // awaits the no-longer-held release (an unpaid nested crysknife can
    // charge during the transfer into the statue).
    await addObjectToContainer(statue, object);
}
async function dropBesideStatue(object, x, y, publish) {
    clearMonsterCarriedObjectState(object);
    return landFloorObject(object, x, y, { state: game, publish });
}
function statueFlags(monster) {
    let flags = 0;
    if (monster.female)
        flags |= CORPSTAT_FEMALE;
    else if (!((MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_NEUTER))
        flags |= CORPSTAT_MALE;
    if ((MONSTER_GENO[monster.mnum] ?? 0) & G_UNIQ)
        flags |= CORPSTAT_HISTORIC;
    return flags;
}
async function createStoneRemains(monster, publish) {
    const x = monster.mx;
    const y = monster.my;
    const frequency = (MONSTER_GENO[monster.mnum] ?? 0) & 0x07;
    const leavesStatue = (MONSTER_SIZE[monster.mnum] ?? 0) > 0
        || rn2(2 + Number(frequency > 2)) === 0;
    if (!leavesStatue) {
        const rock = await mksobj(ROCK, true, false);
        placeCreatedObject(rock, x, y, game);
        return await stack_object(rock, game);
    }
    const contained = [];
    for (const object of [...(monster.minvent || [])]) {
        const worn = object.owornmask;
        await removeObjectFromMonsterInventory(monster, object, game, {
            publish: async () => { },
        });
        // monstone saves traits only after removing item-granted properties.
        if (worn)
            applyMonsterEquipmentProperties(monster, object, false);
        if (object.otyp === BOULDER
            || objectResistsDestruction(object, 0, 0)) {
            await dropBesideStatue(object, x, y, publish);
        }
        else {
            contained.push(object);
        }
    }
    monster.minvent = [];
    monster.inventory = monster.minvent;
    monster.hasInventory = false;
    monster.mw = null;
    monster.misc_worn_check = 0;
    const statue = await mkcorpstat(STATUE, monster, monster.mnum, x, y, statueFlags(monster));
    if (monster.name)
        statue.oname = monster.name;
    for (const object of contained)
        await putInStatue(statue, object);
    statue.owt = objectWeight(statue);
    return await stack_object(statue, game);
}
export async function petrifyMonsterImmediately(monster, { creditHero = false, finishDeath, publish = plineWithContinuation, } = {}) {
    if (!monster || monster.dead || (monster.mhp ?? 1) <= 0)
        return { changed: false, survived: false };
    if (monsterHasStoneResistance(monster))
        return { changed: false, survived: true };
    const stoneForm = await turnGolemToStone(monster, publish);
    if (stoneForm?.heroDied)
        return { heroDied: true };
    if (stoneForm)
        return { changed: true, survived: true };
    const restored = await restoreShapechanger(monster, publish);
    if (restored?.heroDied)
        return { heroDied: true };
    if (restored)
        return { changed: true, survived: true };
    const speed = adjustMonsterSpeed(monster, -3);
    // worn.c:mon_adjust_speed() needs sight of the actor. The following
    // minstapetrify() message only needs sight of its square; that difference
    // matters when the hero is inside this monster.
    if (!game.in_mklev && game.flags.verbose !== false
        && speed.canDescribe && canSeeMonster(monster)) {
        const speedMessage = monsterSpeedMessage(speed, monsterSubject(monster));
        if (speedMessage)
            await publish(speedMessage);
    }
    if (cansee(monster.mx, monster.my)) {
        await publish(`${monsterSubject(monster)} turns to stone.`);
    }
    if (creditHero)
        recordHeroKillConduct();
    return finishMonsterPetrification(monster, { finishDeath, publish });
}
// C mon.c:monstone(). Reversion and life saving precede statue creation.
export async function prepareMonsterPetrification(monster, { publish = plineWithContinuation, } = {}) {
    const restored = await restoreShapechanger(monster, publish);
    if (restored?.heroDied)
        return { heroDied: true };
    if (restored)
        return { changed: true, survived: true };
    monster.mhp = 0;
    const lifeSaver = wornMonsterLifeSaver(monster);
    if (lifeSaver) {
        const visible = cansee(monster.mx, monster.my);
        await lifeSaveMonster(monster, lifeSaver, {
            genocided: speciesWasGenocided(monster.mnum),
        });
        if ((monster.mhp ?? 0) > 0)
            return { changed: true, survived: true, messageShown: visible };
    }
    monster.mtrapped = 0;
    const remains = await createStoneRemains(monster, publish);
    if (game.program_state.gameover)
        return { heroDied: true };
    unmap_invisible(monster.mx, monster.my, false);
    if (cansee(monster.mx, monster.my))
        newsym(monster.mx, monster.my);
    return { changed: true, survived: false, remains };
}
async function finishMonsterPetrification(monster, { finishDeath, publish = plineWithContinuation, } = {}) {
    const result = await prepareMonsterPetrification(monster, { publish });
    if (result.heroDied || result.survived)
        return result;
    if (!finishDeath)
        throw new Error('Petrification requires a monster death handler');
    await finishDeath(monster, { noCorpse: true });
    if (game.program_state.gameover)
        return { heroDied: true };
    return result;
}
//# sourceMappingURL=monster_stoning.js.map