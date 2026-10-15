// C muse.c:find_defensive(), m_use_healing(), and use_defensive().
import {
    BEAR_TRAP, CORR, HOLE, In_endgame, In_sokoban, IS_DRAWBRIDGE, IS_FURNITURE,
    LADDER, MIGR_LADDER_DOWN, MIGR_LADDER_UP, MIGR_RANDOM, MIGR_SSTAIRS,
    MIGR_STAIRS_DOWN, MIGR_STAIRS_UP, PIT, RLOC_MSG, SCORR, STAIRS,
    TELEP_TRAP, WEB, W_NONDIGGABLE, PLNMSG_enum, PLNMSG_UNKNOWN, is_hole, is_pit, isok,
} from './const.js';
import { canSeeMonster, canSpotMonster, newsym, plineWithContinuation } from './display.js';
import { levelAtDepth, levelIsWizardTower } from './dungeon.js';
import { dist2, depth, ledgerNo } from './hacklib.js';
import { formatHeardMessage, publishHeardMessage } from './hero_speech.js';
import { inventoryItemDescription } from './invent.js';
import { artifactById } from './artifacts.js';
import { randomTeleportDepth } from './level_teleport.js';
import { healMonster } from './mon.js';
import { finishImmediateMonsterTrap, triggerImmediateMonsterTrap } from './monmove.js';
import {
    MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_LEVEL, MONSTER_MOVE, MONSTER_NAME, MONSTER_SIZE,
    MONSTER_SYMBOL,
} from './monster_data.js';
import { removeMonsterFromGame } from './monster_departure.js';
import { monsterIsScaredAt } from './monster_fear.js';
import { makeMonsterFlee } from './monster_flee.js';
import {
    consumeMonsterItem, prepareMonsterItemUse, presentMonsterQuaff,
    presentMonsterScrollRead, presentMonsterWandUse,
} from './monster_item_use.js';
import { monsterAtPosition, placeMonsterAt } from './monster_location.js';
import { migrateMonsterOffLevel } from './monster_migration.js';
import { monsterName, monsterObjectPronoun } from './monster_name.js';
import { monsterLocomotion } from './monster_locomotion.js';
import { verbForSubject } from './object_grammar.js';
import { touchPetrifies } from './stoning.js';
import { monsterPolymorphsWhenStoned } from './monster_stoning.js';
import { monsterLinedUpWithHero } from './monster_ranged_alignment.js';
import { findDrawbridgeAt } from './dbridge.js';
import { advanceMonsterWormBody } from './monster_worm.js';
import { maybeUnhideAt } from './monster_hiding.js';
import { tryCallObjectType } from './object_call.js';
import { deleteObject } from './object_delete.js';
import { unlinkObject } from './object_location.js';
import { splitObjectStack } from './object_stack.js';
import { awakenSoldiers } from './music.js';
import { monsterHasStoneResistance } from './monster_resistance.js';
import { monsterCanOpenTin, consumeMonsterStoningCure } from './monster_stoning_cure.js';
import { resolveMonsterImmediateWand } from './monster_wand_ray.js';
import { canDigDown, canFallThrough, makemonAt, maketrap } from './mklev.js';
import {
    AMULET_OF_YENDOR, BELL_OF_OPENING, SPE_BOOK_OF_THE_DEAD, BOULDER, BUGLE,
    CANDELABRUM_OF_INVOCATION, CORPSE, POT_EXTRA_HEALING, POT_FULL_HEALING,
    POT_HEALING, POT_SICKNESS, SCR_CREATE_MONSTER, SCR_TELEPORTATION, TIN,
    UNICORN_HORN, WAN_CREATE_MONSTER, WAN_DIGGING, WAN_TELEPORTATION, WAN_UNDEAD_TURNING,
} from './object_data.js';
import { learnObjectType } from './object_knowledge.js';
import { observeObjectForNaming } from './objnam.js';
import { fillPitWithBoulderAt } from './pit_fill.js';
import { d, rn2, rnd } from './rng.js';
import { heroIsDeaf } from './senses.js';
import { shopkeeperInOwnShop } from './shk.js';
import { isIceAt, isLavaAt, isPoolAt } from './terrain_properties.js';
import { surfaceName } from './terrain_name.js';
import { randomMonsterRelocation } from './teleport.js';
import { findNearbyMonsterPosition, monsterTeleportRestricted, reportMonsterTeleportRestriction } from './teleport_rules.js';
import { monsterKnowsTrap, monsterLearnsTrap } from './trap_knowledge.js';
import { cansee, vision_note_blocker_change } from './vision.js';
import type { PlayingGameState } from './game_state.js';
import type { Stairway, Trap } from './map_types.js';
import type { Monster } from './monster_types.js';
import type { GameObject } from './object_types.js';
import type { MonsterOffensiveOptions, MonsterOffensiveResult } from './monster_offensive_types.js';

const M1_NOHANDS = 0x00002000;
const M1_NOEYES = 0x00001000;
const M1_ANIMAL = 0x00040000;
const M1_MINDLESS = 0x00010000;
const M1_WALLWALK = 0x00000008;
const M2_ROCKTHROW = 0x08000000;
const M2_MERC = 0x00000200;

export type MonsterDefensiveChoice =
    | { kind: 'horn'; object: GameObject | null }
    | { kind: 'lizard' | 'bugle' | 'healing' | 'extra-healing' | 'full-healing'
        | 'digging' | 'teleport-self' | 'teleport-ray' | 'teleport-scroll'
        | 'create-wand' | 'create-scroll' | 'undead-turning'; object: GameObject }
    | { kind: 'stairs'; stair: Stairway }
    | { kind: 'trap'; trap: Trap };

export function findMonsterDefensiveItem(monster: Monster, state: PlayingGameState, {
    tryEscape = false, random = rn2,
}: { tryEscape?: boolean; random?: typeof rn2 } = {}): MonsterDefensiveChoice | null {
    const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
    const noHands = !!(flags & M1_NOHANDS);
    const stuck = state.u.ustuck === monster;
    if (flags & (M1_ANIMAL | M1_MINDLESS)) return null;
    if (!tryEscape && dist2(monster.mx, monster.my, monster.mux ?? state.u.ux, monster.muy ?? state.u.uy) > 25) return null;
    if (state.u.uswallow && stuck) return null;
    if (tryEscape && state.knox_level?.dnum === state.u.uz.dnum
        && state.knox_level.dlevel === state.u.uz.dlevel
        && dist2(monster.mx, monster.my, state.u.ux, state.u.uy) > 2
        && state.level.monsters.some(other => other !== monster && !other.dead
            && dist2(monster.mx, monster.my, other.mx, other.my) <= 2)) return null;
    const inventory = monster.minvent || monster.inventory || [];
    const blind = !monster.mcansee;
    if (monster.mconf || monster.mstun || blind) {
        const horn = noHands ? null : inventory.find(object => object.otyp === UNICORN_HORN && !object.cursed) ?? null;
        if (horn || MONSTER_SYMBOL[monster.mnum] === 21 || MONSTER_NAME[monster.mnum] === 'ki-rin')
            return { kind: 'horn', object: horn };
    }
    if (monster.mconf || monster.mstun) {
        const corpse = inventory.find(object => object.otyp === CORPSE && MONSTER_NAME[object.corpsenm ?? -1] === 'lizard');
        if (corpse) return { kind: 'lizard', object: corpse };
        const tin = inventory.slice().reverse().find(object => object.otyp === TIN && MONSTER_NAME[object.corpsenm ?? -1] === 'lizard');
        if (tin && monsterCanOpenTin(monster) && random(3)) return { kind: 'lizard', object: tin };
    }
    const pestilence = MONSTER_NAME[monster.mnum] === 'Pestilence';
    if (blind && !noHands && !pestilence) {
        const healing = healingChoice(monster);
        if (healing) return healing;
    }
    const weapon = state.uwep || state.u.uwep;
    if (!monster.mpeaceful && !noHands && weapon?.otyp === CORPSE
        && touchPetrifies(weapon.corpsenm ?? -1) && !monsterHasStoneResistance(monster)
        && !monsterPolymorphsWhenStoned(monster)
        && monsterLinedUpWithHero(monster, state, random)) {
        const wand = inventory.find(object => object.otyp === WAN_UNDEAD_TURNING && object.spe > 0);
        if (wand) return { kind: 'undead-turning', object: wand };
    }
    if (!tryEscape) {
        const fraction = state.u.ulevel < 10 ? 5 : state.u.ulevel < 14 ? 4 : 3;
        if (monster.mhp >= monster.mhpmax || monster.mhp >= 10 && monster.mhp * fraction >= monster.mhpmax) return null;
        if (monster.mpeaceful) return noHands ? null : healingChoice(monster);
    }

    let selected = physicalEscape(monster, state, stuck);
    if (noHands) return selected;
    const bugle = inventory.find(object => object.otyp === BUGLE);
    if (bugle && (MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_MERC
        && state.level.monsters.some(other => other !== monster
            && Math.abs(other.mx - monster.mx) <= 3 && Math.abs(other.my - monster.my) <= 3
            && (MONSTER_FLAGS2[other.mnum] ?? 0) & M2_MERC
            && MONSTER_NAME[other.mnum] !== 'guard'
            && (other.msleeping || !other.mcanmove))) selected = { kind: 'bugle', object: bugle };
    if (selected) return selected;

    const cell = state.level.requireAt(monster.mx, monster.my);
    const trap = state.level.traps.find(candidate => candidate.tx === monster.mx && candidate.ty === monster.my);
    const blocksDigging = trap && !is_pit(trap.ttyp) && trap.ttyp !== WEB && trap.ttyp !== BEAR_TRAP;
    for (const object of inventory) {
        if (selected && !random(3)) break;
        if (selected?.kind === 'digging') break;
        if (object.otyp === WAN_DIGGING && object.spe > 0 && !stuck && !blocksDigging
            && !monster.isshk && !monster.isgd && !monster.ispriest && !monsterFloats(monster)
            && !In_sokoban(state.u.uz) && !(cell.wall_info & W_NONDIGGABLE)
            && !atBottom(state) && !In_endgame(state.u.uz)
            && !isIceAt(monster.mx, monster.my, state) && !isPoolAt(monster.mx, monster.my, state)
            && !isLavaAt(monster.mx, monster.my, state)
            && !(MONSTER_NAME[monster.mnum] === 'Vlad the Impaler' && state.dungeons[state.u.uz.dnum]?.dname === "Vlad's Tower"))
            selected = { kind: 'digging', object };
        if (selected?.kind === 'teleport-self' || selected?.kind === 'teleport-ray') continue;
        if (object.otyp === WAN_TELEPORTATION && object.spe > 0 && teleportNotKnownBlocked(monster, state))
            selected = { kind: hasAmulet(monster) ? 'teleport-ray' : 'teleport-self', object };
        if (selected?.kind === 'teleport-scroll') continue;
        if (object.otyp === SCR_TELEPORTATION && monster.mcansee && !(flags & M1_NOEYES)
            && (!object.cursed || !(monster.isshk && shopkeeperInOwnShop(monster, state)) && !monster.isgd && !monster.ispriest)
            && teleportNotKnownBlocked(monster, state)) selected = { kind: 'teleport-scroll', object };
        if (!pestilence) {
            if (selected?.kind === 'full-healing') continue;
            if (object.otyp === POT_FULL_HEALING) selected = { kind: 'full-healing', object };
            if (selected?.kind === 'extra-healing') continue;
            if (object.otyp === POT_EXTRA_HEALING) selected = { kind: 'extra-healing', object };
            if (selected?.kind === 'create-wand') continue;
            if (object.otyp === WAN_CREATE_MONSTER && object.spe > 0) selected = { kind: 'create-wand', object };
            if (selected?.kind === 'healing') continue;
            if (object.otyp === POT_HEALING) selected = { kind: 'healing', object };
        } else {
            if (selected?.kind === 'full-healing') continue;
            if (object.otyp === POT_SICKNESS) selected = { kind: 'full-healing', object };
            if (selected?.kind === 'create-wand') continue;
            if (object.otyp === WAN_CREATE_MONSTER && object.spe > 0) selected = { kind: 'create-wand', object };
        }
        if (selected?.kind === 'create-scroll') continue;
        if (object.otyp === SCR_CREATE_MONSTER) selected = { kind: 'create-scroll', object };
    }
    return selected;
}

function physicalEscape(monster: Monster, state: PlayingGameState, stuck: boolean): MonsterDefensiveChoice | null {
    if (stuck || !MONSTER_MOVE[monster.mnum] || monster.mtrapped) return null;
    const floats = monsterFloats(monster);
    const cell = state.level.requireAt(monster.mx, monster.my);
    if (cell.typ === STAIRS || cell.typ === LADDER) {
        for (let stair = state.stairs; stair; stair = stair.next)
            if (stair.sx === monster.mx && stair.sy === monster.my && (stair.up || !floats)) return { kind: 'stairs', stair };
        return null;
    }
    const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
    const ignoreBoulders = (MONSTER_SIZE[monster.mnum] ?? 0) === 0
        || !!((MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_ROCKTHROW) || !!(flags & M1_WALLWALK);
    const spots = [{ x: monster.mx, y: monster.my }];
    for (let x = monster.mx - 1; x <= monster.mx + 1; x++)
        for (let y = monster.my - 1; y <= monster.my + 1; y++)
            if (isok(x, y) && (x !== monster.mx || y !== monster.my)) spots.push({ x, y });
    let selected: MonsterDefensiveChoice | null = null;
    for (const { x, y } of spots) {
        if (x === state.u.ux && y === state.u.uy) continue;
        if (MONSTER_NAME[monster.mnum] === 'grid bug' && x !== monster.mx && y !== monster.my) continue;
        const occupant = monsterAtPosition(state.level, x, y);
        if (occupant && occupant !== monster) continue;
        const trap = state.level.traps.find(candidate => candidate.tx === x && candidate.ty === y);
        if (!trap || !ignoreBoulders && state.level.objects[x]?.[y]?.some(object => object.otyp === BOULDER)
            || monsterIsScaredAt(monster, state, x, y)) continue;
        if (is_hole(trap.ttyp) && !floats && !monster.isshk && !monster.isgd && !monster.ispriest
            && canFallThrough(state.u.uz)) return { kind: 'trap', trap };
        if (trap.ttyp === TELEP_TRAP) selected = { kind: 'trap', trap };
    }
    return selected;
}

export async function useMonsterDefensiveItem(monster: Monster, choice: MonsterDefensiveChoice,
    options: MonsterOffensiveOptions): Promise<MonsterOffensiveResult> {
    const { state, random = rn2, rollOne = rnd, rollDice = d, publish = plineWithContinuation } = options;
    const object = 'object' in choice ? choice.object : null;
    if (object) {
        const precheck = await prepareMonsterItemUse(monster, object, options);
        if (precheck) return precheck;
    }
    const seen = canSeeMonster(monster);
    const subject = () => monsterName(monster, { state, capitalized: true });
    const spent = (): MonsterOffensiveResult => ({ nativeResult: 2, heroDied: !!state.program_state.gameover });
    switch (choice.kind) {
    case 'horn':
        if (seen) await publish(choice.object ? `${subject()} uses a unicorn horn!`
            : `The tip of ${monsterName(monster, { state })}'s horn glows!`);
        if (!monster.mcansee) await cureMonsterBlindness(monster, seen, options);
        else {
            monster.mconf = monster.mstun = 0;
            if (seen) await publish(`${subject()} seems steadier now.`);
        }
        return spent();
    case 'lizard':
        await consumeMonsterStoningCure(monster, choice.object, { state, publish, stoning: false });
        return spent();
    case 'healing': case 'extra-healing': case 'full-healing': {
        const potion = choice.object;
        await presentMonsterQuaff(monster, potion, options);
        const sign = potion.blessed ? 1 : potion.cursed ? -1 : 0;
        if (choice.kind === 'full-healing') {
            if (potion.otyp === POT_SICKNESS) potion.blessed = false;
            healMonster(monster, monster.mhpmax, potion.blessed ? 8 : 4);
        } else healMonster(monster, rollDice(6 + 2 * sign, choice.kind === 'healing' ? 4 : 8),
            choice.kind === 'healing' ? 1 : potion.blessed ? 5 : 2);
        if (!monster.mcansee && (choice.kind === 'healing' ? !potion.cursed : potion.otyp !== POT_SICKNESS))
            await cureMonsterBlindness(monster, seen, options);
        if (seen) {
            await publish(`${subject()} looks ${choice.kind === 'healing' ? 'better' : choice.kind === 'extra-healing' ? 'much better' : 'completely healed'}.`);
            learnObjectType(potion.otyp, state);
        }
        await consumeMonsterItem(monster, potion, state);
        return spent();
    }
    case 'bugle':
        if (seen) {
            observeObjectForNaming(choice.object, { state });
            await publish(`${subject()} plays ${inventoryItemDescription(choice.object)}!`);
        } else if (!heroIsDeaf(state)) {
            const message = formatHeardMessage('a bugle playing reveille!', state);
            if (message) await publish(message);
        }
        await awakenSoldiers((MONSTER_LEVEL[monster.mnum] ?? 0) * 30, monster);
        return spent();
    case 'teleport-self':
        if (monster.isshk && shopkeeperInOwnShop(monster, state) || monster.isgd || monster.ispriest) return spent();
        await fleeForEscape(monster, options);
        await presentMonsterWandUse(monster, choice.object, { ...options, self: true });
        await teleportForEscape(monster, choice.object.otyp, seen, options);
        return spent();
    case 'teleport-ray': case 'undead-turning':
        await presentMonsterWandUse(monster, choice.object, options);
        state.context.zap_oseen = seen;
        await resolveMonsterImmediateWand(monster, choice.object, options);
        if (choice.kind === 'teleport-ray' && monsterTeleportRestricted(monster, state)) monsterLearnsTrap(monster, { ttyp: TELEP_TRAP });
        return spent();
    case 'teleport-scroll': {
        if (monster.isshk || monster.isgd || monster.ispriest) return spent();
        await fleeForEscape(monster, options);
        const scroll = choice.object.quan > 1 ? splitObjectStack(choice.object, 1, state) : choice.object;
        if (!scroll) throw new Error('A monster teleport scroll must retain one readable copy');
        unlinkObject(scroll, state);
        // A previously seen scroll is nameable only if this use produces feedback.
        state._lastPlineKind = PLNMSG_enum;
        const scrollOptions = {
            ...options,
            publish: async (message: string) => {
                state._lastPlineKind = PLNMSG_UNKNOWN;
                await publish(message);
            },
        };
        await presentMonsterScrollRead(monster, scroll, scrollOptions);
        if (scroll.cursed || monster.mconf) {
            const destination = randomTeleportDepth(state, random, rollOne);
            if (hasAmulet(monster) || In_endgame(state.u.uz)) {
                if (seen) await scrollOptions.publish(`${subject()} seems very disoriented for a moment.`);
            } else if (destination === depth(state.u.uz, state.dungeons)) {
                if (seen) await scrollOptions.publish(`${subject()} shudders for a moment.`);
            } else await migrateMonsterOffLevel(monster, state, { dst: levelAtDepth(destination, { state }) });
        } else await teleportForEscape(monster, scroll.otyp, seen, scrollOptions);
        if (scroll.dknown && state._lastPlineKind !== PLNMSG_enum) await tryCallObjectType(scroll, state);
        await deleteObject(scroll, state);
        return spent();
    }
    case 'create-wand': case 'create-scroll': {
        let count = 1;
        const confused = choice.kind === 'create-scroll' && !!monster.mconf;
        if (choice.kind === 'create-scroll') {
            if (!random(73)) count += rollOne(4);
            if (confused || choice.object.cursed) count += 12;
        }
        const placementSpecies = confused ? 6 : isPoolAt(monster.mx, monster.my, state)
            ? state.u.uinwater ? 319 : 328 : null;
        let known = false;
        let zapped = false;
        if (choice.kind === 'create-scroll') await presentMonsterScrollRead(monster, choice.object, options);
        while (count-- > 0) {
            const point = findNearbyMonsterPosition(placementSpecies, monster.mx, monster.my, { state, random });
            if (!point) break;
            if (choice.kind === 'create-wand') {
                await presentMonsterWandUse(monster, choice.object, options);
                zapped = true;
            }
            const created = await makemonAt(confused ? 6 : null, point.x, point.y);
            known ||= !!created && canSpotMonster(created);
        }
        if (known && (choice.kind === 'create-scroll' || seen)) learnObjectType(choice.object.otyp, state);
        if (choice.kind === 'create-scroll') {
            if (!known) await tryCallObjectType(choice.object, state);
            await consumeMonsterItem(monster, choice.object, state);
        } else if (!zapped) return { nativeResult: 0, heroDied: false };
        return spent();
    }
    case 'digging': {
        await fleeForEscape(monster, options);
        await presentMonsterWandUse(monster, choice.object, options);
        if (seen) learnObjectType(WAN_DIGGING, state);
        const { mx: x, my: y } = monster;
        const cell = state.level.requireAt(x, y);
        if (IS_FURNITURE(cell.typ) || IS_DRAWBRIDGE(cell.typ) || findDrawbridgeAt(x, y, state)
            || stairAt(state, x, y)) {
            await publish('The digging ray is ineffective.');
            return spent();
        }
        const hole = canDigDown(state.u.uz) || cell.candig;
        if (!hole && state.level.traps.some(trap => trap.tx === x && trap.ty === y)) {
            if (seen) await publish(`The ${surfaceName(x, y, state)} here is too hard to dig in.`);
            return spent();
        }
        const trap = await maketrap(x, y, hole ? HOLE : PIT);
        if (!trap) return spent();
        trap.tseen = !!hole || cansee(x, y);
        if (hole) vision_note_blocker_change(x, y);
        if (cansee(x, y)) {
            await publish(`${subject()} has made a ${hole ? 'hole' : 'pit'} in the ${surfaceName(x, y, state)}.`);
            if (hole) await publish(`${subject()} ${(MONSTER_FLAGS1[monster.mnum] ?? 0) & 1 ? 'dives' : 'falls'} through...`);
        } else if (hole && !heroIsDeaf(state)) await publishHeardMessage(`something crash through the ${surfaceName(x, y, state)}.`, publish, state);
        await fillPitWithBoulderAt(x, y, state, { publish });
        if (hole) await migrateMonsterOffLevel(monster, state, { dst: { dnum: state.u.uz.dnum, dlevel: state.u.uz.dlevel + 1 } });
        else {
            vision_note_blocker_change(x, y);
            const action = await triggerImmediateMonsterTrap(monster, state, { forceBungle: true, random, rollOne, rollDice });
            await finishImmediateMonsterTrap(action, state, { publish, random, rollOne, rollDice });
            if (action.event?.kind === 'pit-trap' && action.event.killed)
                return { nativeResult: 1, heroDied: !!state.program_state.gameover };
        }
        return spent();
    }
    case 'stairs': {
        await fleeForEscape(monster, options);
        const stair = choice.stair;
        const branch = stair.tolev.dnum !== state.u.uz.dnum;
        const ladder = stair.isladder && !branch;
        if (ledgerNo(state.u.uz, state) === 1 && (branch || stair.up && !ladder)) {
            if (monsterHasSpecial(monster, state) || monster.iswiz && (state.context.no_of_wizards ?? 0) < 2) return { nativeResult: 0, heroDied: false };
            if (seen) await publish(`${subject()} escapes the dungeon!`);
            await removeMonsterFromGame(monster);
            return spent();
        }
        let destination = stair.tolev;
        let mode = branch ? MIGR_SSTAIRS
            : ladder ? stair.up ? MIGR_LADDER_DOWN : MIGR_LADDER_UP
                : stair.up ? MIGR_STAIRS_DOWN : MIGR_STAIRS_UP;
        if (mode === MIGR_STAIRS_DOWN && state.dungeons[state.u.uz.dnum]?.flags.hellish
            && hasAmulet(monster) && !random(4)
            && state.u.uz.dlevel < (state.dungeons[state.u.uz.dnum]?.num_dunlevs ?? 0) - 3) {
            if (seen) await publish(`As ${monsterName(monster, { state })} climbs the stairs, a mysterious force momentarily surrounds ${monsterObjectPronoun(monster, { state })}...`);
            destination = { dnum: state.u.uz.dnum, dlevel: state.u.uz.dlevel + 1 };
            mode = MIGR_RANDOM;
        } else if (seen) await publish(`${subject()} escapes ${ladder ? `${stair.up ? 'up' : 'down'} the ladder` : `${stair.up ? 'up' : 'down'}stairs`}!`);
        await migrateMonsterOffLevel(monster, state, { dst: destination }, { mode });
        return spent();
    }
    case 'trap': {
        const trap = choice.trap;
        const hole = is_hole(trap.ttyp);
        if (hole && atBottom(state)) return { nativeResult: 0, heroDied: false };
        await fleeForEscape(monster, options);
        const visible = cansee(monster.mx, monster.my);
        if (visible) {
            const name = subject();
            const verb = verbForSubject(name, monsterLocomotion(monster.mnum, 'jump'));
            const trapName = hole ? trap.ttyp === HOLE ? 'hole' : 'trap door' : 'teleportation trap';
            await publish(`${name} ${verb} ${hole ? 'into' : 'onto'} a ${trapName}!`);
        }
        const cell = state.level.requireAt(trap.tx, trap.ty);
        if (cell.typ === SCORR) { cell.typ = CORR; cell.flags = 0; vision_note_blocker_change(trap.tx, trap.ty); }
        if (visible) trap.tseen = true;
        const oldx = monster.mx, oldy = monster.my;
        placeMonsterAt(monster, trap.tx, trap.ty);
        newsym(oldx, oldy);
        if (monster.wormno) advanceMonsterWormBody(monster, { state, random, rollOne, rollDice });
        maybeUnhideAt(monster.mx, monster.my, state);
        newsym(monster.mx, monster.my);
        if (hole) await migrateMonsterOffLevel(monster, state, { dst: { dnum: state.u.uz.dnum, dlevel: state.u.uz.dlevel + 1 } });
        else await teleportForEscape(monster, 0, seen, options, trap);
        return spent();
    }
    }
}

async function cureMonsterBlindness(monster: Monster, seen: boolean, options: MonsterOffensiveOptions): Promise<void> {
    monster.mcansee = 1;
    monster.mblinded = 0;
    if (seen && !((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_NOEYES)) await (options.publish ?? plineWithContinuation)(`${monsterName(monster, { state: options.state, capitalized: true })} can see again.`);
}

async function fleeForEscape(monster: Monster, options: MonsterOffensiveOptions): Promise<void> {
    if (monster.mflee || monster.iswiz) return;
    const turns = 33 - Math.trunc(30 * monster.mhp / monster.mhpmax);
    if (turns) await makeMonsterFlee(monster, { ...options, turns, announce: false });
}

async function teleportForEscape(monster: Monster, type: number, seen: boolean, options: MonsterOffensiveOptions, trap: Trap | null = null): Promise<void> {
    const { state, random = rn2, rollOne = rnd, rollDice = d, publish = plineWithContinuation } = options;
    if (await reportMonsterTeleportRestriction(monster, { state, publish })) {
        if (seen && type) learnObjectType(type, state);
        monsterLearnsTrap(monster, { ttyp: TELEP_TRAP });
    } else if ((hasAmulet(monster) || levelIsWizardTower(state)) && !random(3)) {
        if (seen) await publish(`${monsterName(monster, { state, capitalized: true })} seems disoriented for a moment.`);
    } else {
        if (seen && type) learnObjectType(type, state);
        if (trap) {
            const action = await triggerImmediateMonsterTrap(monster, state, { force: true, random, rollOne, rollDice, publish });
            await finishImmediateMonsterTrap(action, state, { publish, random, rollOne, rollDice });
        } else await randomMonsterRelocation(monster, { ...options, flags: RLOC_MSG });
    }
}

function teleportNotKnownBlocked(monster: Monster, state: PlayingGameState): boolean {
    return !monsterTeleportRestricted(monster, state) || !monsterKnowsTrap(monster, { ttyp: TELEP_TRAP });
}

function hasAmulet(monster: Monster): boolean {
    return (monster.minvent || monster.inventory || []).some(object => object.otyp === AMULET_OF_YENDOR);
}

function monsterHasSpecial(monster: Monster, state: PlayingGameState): boolean {
    return (monster.minvent || monster.inventory || []).some(object =>
        artifactById(object.oartifact, state)?.questArtifact
        || [AMULET_OF_YENDOR, BELL_OF_OPENING, CANDELABRUM_OF_INVOCATION, SPE_BOOK_OF_THE_DEAD].includes(object.otyp));
}

function atBottom(state: PlayingGameState): boolean {
    return state.u.uz.dlevel === state.dungeons[state.u.uz.dnum]?.num_dunlevs;
}

function monsterFloats(monster: Monster): boolean {
    const symbol = MONSTER_SYMBOL[monster.mnum];
    return symbol === 5 || symbol === 25; // S_EYE, S_LIGHT
}

function stairAt(state: PlayingGameState, x: number, y: number): Stairway | null {
    for (let stair = state.stairs; stair; stair = stair.next)
        if (stair.sx === x && stair.sy === y) return stair;
    return null;
}

function healingChoice(monster: Monster): MonsterDefensiveChoice | null {
    const inventory = monster.minvent || monster.inventory || [];
    for (const [type, kind] of healingTypes) {
        const object = inventory.find(item => item.otyp === type);
        if (object) return { kind, object };
    }
    return null;
}

const healingTypes: readonly (readonly [number, 'full-healing' | 'extra-healing' | 'healing'])[] = [
    [POT_FULL_HEALING, 'full-healing'], [POT_EXTRA_HEALING, 'extra-healing'], [POT_HEALING, 'healing'],
];
