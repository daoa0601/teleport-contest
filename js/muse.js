// muse.js - items generated for monsters to use.
// C refs: muse.c rnd_offensive_item(), rnd_defensive_item(), rnd_misc_item().
import { game } from './gstate.js';
import { objectIsHardHelmet } from './armor.js';
import { W_ARMH } from './const.js';
import { MONSTER_ATTACKS, MONSTER_DIFFICULTY, MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_MOVE, MONSTER_NAME, MONSTER_SIZE, MONSTER_SYMBOL, monsterIsKop, monsterIsNonliving, monsterIsVampireShifter, } from './monster_data.js';
import { AT_EXPL } from './monster_attack_types.js';
import { AMULET_OF_LIFE_SAVING, BAG_OF_TRICKS, BOULDER, BULLWHIP, POT_ACID, POT_BLINDNESS, POT_CONFUSION, POT_EXTRA_HEALING, POT_FULL_HEALING, POT_GAIN_LEVEL, POT_HEALING, POT_INVISIBILITY, POT_PARALYSIS, POT_POLYMORPH, POT_SICKNESS, POT_SLEEPING, POT_SPEED, SCR_CREATE_MONSTER, SCR_EARTH, SCR_TELEPORTATION, WAN_COLD, WAN_CREATE_MONSTER, WAN_DEATH, WAN_DIGGING, WAN_FIRE, WAN_LIGHTNING, WAN_MAGIC_MISSILE, WAN_MAKE_INVISIBLE, WAN_POLYMORPH, WAN_SLEEP, WAN_SPEED_MONSTER, WAN_STRIKING, WAN_TELEPORTATION, } from './object_data.js';
import { monsterTeleportRestricted } from './teleport_rules.js';
import { monsterName } from './monster_name.js';
import { dist2, distmin, depth } from './hacklib.js';
import { cansee } from './vision.js';
import { canSeeMonster, newsym } from './display.js';
import { plineWithContinuation } from './pline.js';
import { rn2, rnd } from './rng.js';
import { recordRandom } from './monster_action_types.js';
import { requireInitializedGame } from './gstate.js';
import { POLY_TRAP, W_ARM, W_ARMF, isok } from './const.js';
import { objectMaterial } from './object_material.js';
import { AT_GAZE } from './monster_attack_types.js';
import { heroCanSeeInvisible } from './mcastu.js';
import { monsterAt, placeMonsterOnMap, removeMonsterFromMapAt, } from './monster_location.js';
import { monsterIsScaredAt } from './monster_fear.js';
import { trapAt, seeTrap } from './trap.js';
import { isContainer } from './container.js';
import { isQuantumBox } from './quantum_cat.js';
import { canLetGo } from './hero_inventory.js';
import { prepareMonsterItemUse, presentMonsterQuaff, presentMonsterWandUse, consumeMonsterItem, } from './monster_item_use.js';
import { lootMonsterContainer } from './monster_container_loot.js';
import { maybeUnhideAt } from './monster_hiding.js';
import { advanceMonsterWormBody } from './monster_worm.js';
import { changeMonsterForm } from './monster_polymorph.js';
import { dragonFormForArmor } from './armor.js';
import { rndmonstAdj } from './makemon.js';
import { learnObjectType } from './object_knowledge.js';
import { migrateMonsterOffLevel } from './monster_migration.js';
import { growMonster } from './monster_growth.js';
import { adjustMonsterSpeed } from './monster_speed.js';
import { setMonsterPermanentInvisibility } from './monster_invisibility.js';
import { useMonsterBullwhip } from './monster_bullwhip.js';
import { monsterLocomotion } from './monster_locomotion.js';
import { trapName } from './trap_name.js';
import { verbForSubject } from './object_grammar.js';
import { canHeroRiseUp, levelAtDepth, sameDungeonLevel } from './dungeon.js';
const M1_AMORPHOUS = 0x00000004;
const M1_WALLWALK = 0x00000008;
const M1_MINDLESS = 0x00010000;
const M1_ANIMAL = 0x00040000;
const M1_UNSOLID = 0x00100000;
const S_GHOST = 54;
const PM_PESTILENCE = 312;
function rejectsRandomItem(monster) {
    const mndx = monster.mnum;
    const flags = MONSTER_FLAGS1[mndx] ?? 0;
    const symbol = MONSTER_SYMBOL[mndx];
    return !!(flags & (M1_ANIMAL | M1_MINDLESS))
        || (MONSTER_ATTACKS[mndx] || []).some(attack => attack[0] === AT_EXPL)
        || symbol === S_GHOST || monsterIsKop(mndx);
}
function wornHelmet(monster) {
    const inventory = monster?.minvent || monster?.inventory || [];
    return inventory.find(object => ((object.owornmask ?? 0) & W_ARMH) !== 0
        || object.wornSlot === 'helmet') || null;
}
export function randomOffensiveMonsterItem(monster) {
    if (!monster || rejectsRandomItem(monster))
        return 0;
    const mndx = monster.mnum;
    const difficulty = MONSTER_DIFFICULTY[mndx] ?? 0;
    if (difficulty > 7 && !rn2(35))
        return WAN_DEATH;
    switch (rn2(9 - Number(difficulty < 4) + 4 * Number(difficulty > 6))) {
        case 0: {
            const flags = MONSTER_FLAGS1[mndx] ?? 0;
            if (objectIsHardHelmet(wornHelmet(monster))
                || (flags & (M1_AMORPHOUS | M1_WALLWALK | M1_UNSOLID))
                || MONSTER_SYMBOL[mndx] === S_GHOST)
                return SCR_EARTH;
            return WAN_STRIKING;
        }
        case 1:
            return WAN_STRIKING;
        case 2:
            return POT_ACID;
        case 3:
            return POT_CONFUSION;
        case 4:
            return POT_BLINDNESS;
        case 5:
            return POT_SLEEPING;
        case 6:
            return POT_PARALYSIS;
        case 7:
        case 8:
            return WAN_MAGIC_MISSILE;
        case 9:
            return WAN_SLEEP;
        case 10:
            return WAN_FIRE;
        case 11:
            return WAN_COLD;
        default:
            return WAN_LIGHTNING;
    }
}
export function randomDefensiveMonsterItem(monster) {
    if (!monster || rejectsRandomItem(monster))
        return 0;
    const mndx = monster.mnum;
    const symbol = MONSTER_SYMBOL[mndx];
    const difficulty = MONSTER_DIFFICULTY[mndx] ?? 0;
    let teleportTries = 0;
    for (;;) {
        switch (rn2(8 + Number(difficulty > 3) + Number(difficulty > 6)
            + Number(difficulty > 8))) {
            case 6:
            case 9:
                if (monsterTeleportRestricted(monster, game)
                    && ++teleportTries < 2)
                    continue;
                if (!rn2(3))
                    return WAN_TELEPORTATION;
                return SCR_TELEPORTATION;
            case 0:
            case 1:
                return SCR_TELEPORTATION;
            case 8:
            case 10:
                if (!rn2(3))
                    return WAN_CREATE_MONSTER;
                return SCR_CREATE_MONSTER;
            case 2:
                return SCR_CREATE_MONSTER;
            case 3:
                return POT_HEALING;
            case 4:
                return POT_EXTRA_HEALING;
            case 5:
                return mndx === PM_PESTILENCE
                    ? POT_SICKNESS : POT_FULL_HEALING;
            case 7:
                if (game.level?.flags?.sokoban_rules && rn2(4))
                    continue;
                if (symbol === 5 || symbol === 25
                    || monster.isshk || monster.isgd || monster.ispriest)
                    return 0;
                return WAN_DIGGING;
        }
    }
}
export function randomMiscMonsterItem(monster) {
    if (!monster || rejectsRandomItem(monster))
        return 0;
    const mndx = monster.mnum;
    const difficulty = MONSTER_DIFFICULTY[mndx] ?? 0;
    if (difficulty < 6 && !rn2(30))
        return rn2(6) ? POT_POLYMORPH : WAN_POLYMORPH;
    if (!rn2(40) && !monsterIsNonliving(mndx) && !monsterIsVampireShifter(monster))
        return AMULET_OF_LIFE_SAVING;
    switch (rn2(3)) {
        case 0:
            if (monster.isgd)
                return 0;
            return rn2(6) ? POT_SPEED : WAN_SPEED_MONSTER;
        case 1: {
            const seesInvisible = !!(game.u?.seeInvisible
                || (game.u?.seeInvisibleTurns ?? 0) > 0);
            if (monster.mpeaceful && !seesInvisible)
                return 0;
            return rn2(6) ? POT_INVISIBILITY : WAN_MAKE_INVISIBLE;
        }
        default:
            return POT_GAIN_LEVEL;
    }
}
// ---------------------------------------------------------------------------
// C muse.c:find_misc()/use_misc(): the discretionary item a monster takes
// out of its own inventory, and the state half of that use once its leading
// message has been presented.
// ---------------------------------------------------------------------------
const M1_NOHANDS = 0x00002000;
const M2_ROCKTHROW = 0x08000000;
const MSLOW = 1;
const MFAST = 2;
const IRON = 11;
function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}
async function heroCanReleaseWeapon(object, state) {
    return !!object && await canLetGo(object, '', state);
}
// C muse.c:use_misc() cursed potion of gain level: the drinker rises one
// level when it can leave through the ceiling from its own square.
export function monsterGainLevelRiseDestination(monster, state) {
    if (!canHeroRiseUp(monster.mx, monster.my, { state }))
        return null;
    const destination = levelAtDepth(depth(state.u.uz, state.dungeons) - 1, { state });
    return sameDungeonLevel(destination, state.u.uz) ? null : destination;
}
// C muse.c:find_misc().  JavaScript minvent mirrors the C chain
// head-to-tail.  Scan newest-to-oldest and retain each later viable type,
// exactly matching C's "last viable item wins" loop.
export async function useMonsterMiscItem(monster, state, random, calls) {
    const flags = MONSTER_FLAGS1[monster?.mnum] ?? 0;
    if (flags & (M1_MINDLESS | M1_ANIMAL) ||
        dist2(monster.mx, monster.my, monster.mux ?? state?.u?.ux ?? monster.mx, monster.muy ?? state?.u?.uy ?? monster.my) > 36)
        return null;
    if (state.u.uswallow && state.u.ustuck === monster)
        return null;
    const inventory = monster.minvent || monster.inventory || [];
    const heroWeapon = state?.uwep || state?.u?.uwep || null;
    const heroSwapWeapon = state?.uswapwep || state?.u?.uswapwep || null;
    const apparentX = monster.mux ?? state?.u?.ux ?? monster.mx;
    const apparentY = monster.muy ?? state?.u?.uy ?? monster.my;
    const heroX = state?.u?.ux ?? monster.mx;
    const heroY = state?.u?.uy ?? monster.my;
    const heroSeesInvisible = heroCanSeeInvisible(state);
    const hasGaze = (MONSTER_ATTACKS[monster?.mnum] || []).some(([attackType]) => attackType === AT_GAZE);
    const stuck = state.u.ustuck === monster;
    const weak = (MONSTER_DIFFICULTY[monster.mnum] ?? 0) < 6;
    const naturalForm = (monster.cham ?? -1) < 0;
    if (!stuck && MONSTER_MOVE[monster.mnum] && !monster.mtrapped && naturalForm && weak
        && !inventory.some(object => !!((object.owornmask ?? 0) & W_ARMF)
            && objectMaterial(object.otyp) === IRON)) {
        for (let x = monster.mx - 1; x <= monster.mx + 1; x++) {
            for (let y = monster.my - 1; y <= monster.my + 1; y++) {
                if (!isok(x, y) || x === heroX && y === heroY
                    || MONSTER_NAME[monster.mnum] === 'grid bug' && x !== monster.mx && y !== monster.my
                    || monsterAt(state, x, y, monster))
                    continue;
                const ignoresBoulders = (MONSTER_SIZE[monster.mnum] ?? 0) < 1
                    || !!((MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_ROCKTHROW) || !!(flags & M1_WALLWALK);
                if (!ignoresBoulders && state.level.objects[x]?.[y]?.some(object => object.otyp === BOULDER)
                    || monsterIsScaredAt(monster, state, x, y))
                    continue;
                const trap = trapAt(state, x, y);
                if (trap?.ttyp === POLY_TRAP)
                    return { kind: 'polymorph-trap', trap, deferredEffect: true };
            }
        }
    }
    if (flags & M1_NOHANDS)
        return null;
    let selected = null;
    for (let index = 0; index < inventory.length; index++) {
        const object = inventory[index];
        if (!object)
            continue;
        // muse.c:find_misc() lets a temple priest use an uncursed gain-level
        // potion, but rejects a cursed one so the resident cannot leave the
        // shrine level. Growth remains deferred across both mquaffmsg()
        // toplines.
        if (object.otyp === POT_GAIN_LEVEL &&
            (!object.cursed || (!monster.isgd && !monster.isshk && !monster.ispriest))) {
            selected = {
                kind: 'potion-gain-level',
                object,
                index,
                deferredEffect: true,
            };
        }
        if (selected?.kind === 'bullwhip-disarm')
            continue;
        if (object.otyp === BULLWHIP &&
            !monster.mpeaceful &&
            heroWeapon) {
            // Source ordering is intentional: rn2(5) precedes the wielded,
            // location, adjacency, and canletgo predicates.
            const attempt = recordRandom(random, calls, 5) === 0;
            if (attempt &&
                object === monster.mw &&
                apparentX === heroX &&
                apparentY === heroY &&
                distmin(monster.mx, monster.my, heroX, heroY) <= 1 &&
                !state?.u?.uswallow &&
                (await heroCanReleaseWeapon(heroWeapon, state) ||
                    (state?.u?.twoweap && await heroCanReleaseWeapon(heroSwapWeapon, state)))) {
                selected = {
                    kind: 'bullwhip-disarm',
                    object,
                    index,
                    heroWeapon,
                    heroSwapWeapon,
                };
            }
        }
        if (selected?.kind === 'wand-invisibility')
            continue;
        if (object.otyp === WAN_MAKE_INVISIBLE && object.spe > 0 && !monster.minvis
            && !monster.invis_blkd && (!monster.mpeaceful || heroSeesInvisible)
            && (!hasGaze || monster.mcan))
            selected = { kind: 'wand-invisibility', object, index, deferredEffect: true };
        if (selected?.kind === 'potion-invisibility')
            continue;
        if (object.otyp === POT_INVISIBILITY &&
            !monster.minvis &&
            !monster.invis_blkd &&
            (!monster.mpeaceful || heroSeesInvisible) &&
            (!hasGaze || monster.mcan)) {
            selected = { kind: 'potion-invisibility', object, index };
        }
        if (selected?.kind === 'wand-speed-monster')
            continue;
        if (object.otyp === WAN_SPEED_MONSTER &&
            (object.spe ?? 0) > 0 &&
            monster.mspeed !== MFAST &&
            !monster.isgd) {
            selected = { kind: 'wand-speed-monster', object, index };
        }
        if (selected?.kind === 'potion-speed')
            continue;
        if (object.otyp === POT_SPEED &&
            monster.mspeed !== MFAST &&
            !monster.isgd) {
            selected = { kind: 'potion-speed', object, index };
        }
        if (selected?.kind === 'wand-polymorph')
            continue;
        if (object.otyp === WAN_POLYMORPH && object.spe > 0 && naturalForm && weak)
            selected = { kind: 'wand-polymorph', object, index, deferredEffect: true };
        if (selected?.kind === 'potion-polymorph')
            continue;
        if (object.otyp === POT_POLYMORPH && naturalForm && weak)
            selected = { kind: 'potion-polymorph', object, index, deferredEffect: true };
        if (selected?.kind === 'container')
            continue;
        if (isContainer(object) && object.otyp !== BAG_OF_TRICKS && !recordRandom(random, calls, 5)
            && !isQuantumBox(object) && !selected && object.contents?.length && !object.olocked && !object.otrapped)
            selected = { kind: 'container', object, index, deferredEffect: true };
    }
    if (!selected)
        return null;
    const precheck = await prepareMonsterItemUse(monster, selected.object, { state, random });
    if (precheck)
        return { kind: 'item-result', object: selected.object, index: selected.index, ...precheck };
    if (selected.kind === 'container') {
        const removed = await lootMonsterContainer(monster, selected.object, { state, random });
        return { kind: 'item-result', object: selected.object, index: selected.index, nativeResult: removed ? 2 : 0, heroDied: false };
    }
    if (selected.kind === 'wand-invisibility'
        || selected.kind === 'wand-polymorph' || selected.kind === 'potion-polymorph')
        return selected;
    if (selected.kind === 'potion-gain-level')
        return selected;
    if (selected.kind === 'potion-invisibility') {
        // mquaffmsg() can suspend on an older topline.  allmain applies the
        // state change and consumes the potion only after that await resumes.
        return { ...selected, deferredEffect: true };
    }
    if (selected.kind === 'bullwhip-disarm') {
        // use_misc() chooses the destination before any two-weapon target
        // selection.  Removal itself follows the urgent wrap message.
        const whereTo = recordRandom(random, calls, 4);
        let target = selected.heroWeapon;
        if (!await heroCanReleaseWeapon(target, state) ||
            (state?.u?.twoweap &&
                await heroCanReleaseWeapon(selected.heroSwapWeapon, state) &&
                recordRandom(random, calls, 2))) {
            target = selected.heroSwapWeapon;
        }
        return {
            ...selected,
            target,
            whereTo,
            deferredEffect: true,
        };
    }
    const { object } = selected;
    const wand = object.otyp === WAN_SPEED_MONSTER;
    return {
        ...selected,
        kind: wand ? 'wand-speed-monster' : 'potion-speed',
        deferredEffect: true,
    };
}
// Complete the state half of a miscellaneous action only after its leading
// tty message has returned.  This preserves use_misc() suspension boundaries.
export async function finishDeferredMonsterMiscItem(action, state = requireInitializedGame()) {
    const monster = action?.monster;
    const misc = action?.movement?.usedMisc;
    if (!monster || !misc?.deferredEffect || misc.effectApplied)
        return misc;
    if (misc.kind === 'polymorph-trap') {
        const trapVisible = cansee(misc.trap.tx, misc.trap.ty);
        if (cansee(monster.mx, monster.my) || trapVisible)
            await seeTrap(misc.trap, state);
        if (canSeeMonster(monster) || trapVisible) {
            const subject = monsterName(monster, { state, capitalized: true, augmentIt: true });
            const verb = verbForSubject(subject, monsterLocomotion(monster.mnum, 'jump'));
            await plineWithContinuation(`${subject} deliberately ${verb} onto a ${misc.trap.tseen ? trapName(misc.trap.ttyp, { state }) : 'hidden trap'}!`);
        }
        const oldx = monster.mx, oldy = monster.my;
        // use_misc() removes even a monster already standing on the trap.
        removeMonsterFromMapAt(oldx, oldy, state);
        await newsym(oldx, oldy);
        await placeMonsterOnMap(monster, misc.trap.tx, misc.trap.ty, state);
        await maybeUnhideAt(monster.mx, monster.my, state);
        if (monster.wormno)
            await advanceMonsterWormBody(monster, { state });
        await newsym(monster.mx, monster.my);
        await changeMonsterForm(monster, null, state, { showMessage: true });
        misc.effectApplied = true;
        return misc;
    }
    if (misc.kind === 'wand-polymorph' || misc.kind === 'potion-polymorph') {
        const seen = canSeeMonster(monster);
        if (misc.kind === 'wand-polymorph')
            await presentMonsterWandUse(monster, misc.object, { state, self: true });
        else {
            await presentMonsterQuaff(monster, misc.object, { state });
            await consumeMonsterItem(monster, misc.object, state);
            if (seen)
                await plineWithContinuation(`${monsterName(monster, { state, capitalized: true })} suddenly mutates!`);
        }
        const armor = (monster.minvent || []).find(object => !!((object.owornmask ?? 0) & W_ARM));
        const target = dragonFormForArmor(armor) ?? rndmonstAdj();
        await changeMonsterForm(monster, target, state, { showMessage: true, polyspot: misc.kind === 'wand-polymorph' });
        if (seen)
            learnObjectType(misc.object.otyp, state);
        misc.effectApplied = true;
        return misc;
    }
    if (misc.kind === 'potion-invisibility' || misc.kind === 'wand-invisibility') {
        setMonsterPermanentInvisibility(monster, !misc.object.cursed);
        misc.effectApplied = true;
        return misc;
    }
    if (misc.kind === 'potion-gain-level') {
        await consumeMonsterItem(monster, misc.object, state);
        if (misc.object.cursed) {
            if (misc.riseDestination)
                await migrateMonsterOffLevel(monster, state, { dst: misc.riseDestination });
            misc.effectApplied = true;
            return misc;
        }
        misc.growth = growMonster(monster, {
            state,
            rollOne: rnd,
            random: rn2,
            calls: action.calls,
        });
        if (misc.growth.maxIncrease !== undefined)
            misc.increase = misc.growth.maxIncrease;
        misc.effectApplied = true;
        return misc;
    }
    if (misc.kind === 'wand-speed-monster' || misc.kind === 'potion-speed') {
        const speed = adjustMonsterSpeed(monster, 1);
        misc.oldSpeed = speed.oldSpeed;
        misc.speedChanged = speed.changed && speed.canDescribe && !state.in_mklev;
        misc.speedMuch = speed.much;
        misc.effectApplied = true;
        return misc;
    }
    if (misc.kind === 'bullwhip-disarm') {
        const target = misc.target;
        if (target)
            await useMonsterBullwhip(monster, target, misc.whereTo ?? 0, state);
        misc.effectApplied = true;
    }
    return misc;
}
//# sourceMappingURL=muse.js.map