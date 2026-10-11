// C muse.c:find_offensive() and its targeting helpers.
import { objectIsHardHelmet } from './armor.js';
import { heroResistsBlindingLight } from './blinding_attack.js';
import { heroHasInvoluntaryDelay } from './command_state.js';
import {
    BOLT_LIM, M_SEEN_ACID, M_SEEN_COLD, M_SEEN_ELEC, M_SEEN_FIRE,
    M_SEEN_MAGR, M_SEEN_REFL, M_SEEN_SLEEP, TELEP_TRAP, W_ARMH, isok,
} from './const.js';
import { heroSpecies } from './hero_species.js';
import { speciesCanBlow } from './monster_anatomy.js';
import { AD_HEAL, AT_GAZE } from './monster_attack_types.js';
import {
    MONSTER_ATTACKS, MONSTER_FLAGS1, MONSTER_NAME,
    monsterHasNoHands, monsterHatesLight, monsterIsAmorphous,
    monsterIsAnimal, monsterIsMindless, monsterIsNoncorporeal, monsterIsUnsolid,
} from './monster_data.js';
import { monsterIsScaredAt } from './monster_fear.js';
import { monsterWantsFloorObject } from './monster_item_interest.js';
import { monsterAtPosition } from './monster_location.js';
import { blockingTerrain, monsterLinedUpWithHero } from './monster_ranged_alignment.js';
import {
    CORPSE, EXPENSIVE_CAMERA, FIRE_HORN, FROST_HORN, POT_ACID, POT_BLINDNESS,
    POT_CONFUSION, POT_PARALYSIS, POT_SLEEPING, SCR_EARTH, WAN_COLD, WAN_DEATH,
    WAN_FIRE, WAN_LIGHTNING, WAN_MAGIC_MISSILE, WAN_SLEEP, WAN_STRIKING,
    WAN_TELEPORTATION, WAN_UNDEAD_TURNING,
} from './object_data.js';
import { inHeroSanctuary } from './priest.js';
import { rn2 } from './rng.js';
import { heroIsBlind } from './senses.js';
import { heroControlsTeleport } from './teleport.js';
import { monsterTeleportRestricted } from './teleport_rules.js';
import { isAccessibleAt } from './terrain_properties.js';
import type { DungeonLocation } from './dungeon_types.js';
import type { PlayingGameState } from './game_state.js';
import type { MonsterOffensiveChoice } from './monster_offensive_types.js';
import type { Monster } from './monster_types.js';

const M1_NOEYES = 0x00001000;
const M1_WALLWALK = 0x00000008;
const PM_GRID_BUG = MONSTER_NAME.indexOf('grid bug');

export function selectMonsterOffensiveItem(
    monster: Monster, state: PlayingGameState, { random = rn2 }: { random?: typeof rn2 } = {},
): MonsterOffensiveChoice | null {
    if (monster.mpeaceful || monsterIsAnimal(monster)
        || monsterIsMindless(monster.mnum) || monsterHasNoHands(monster.mnum)
        || state.u.uswallow || inHeroSanctuary(monster, 0, 0, state)) return null;
    const attacks = MONSTER_ATTACKS[monster.mnum] ?? [];
    if (attacks.some(([, damage]) => damage === AD_HEAL) && heroIsNakedAndUnarmed(state))
        return null;
    if (!monsterLinedUpWithHero(monster, state, random)) return null;

    const seen = monster.seen_resistance ?? 0;
    const distance = (monster.mx - (monster.mux ?? 0)) ** 2
        + (monster.my - (monster.muy ?? 0)) ** 2;
    const adjacent = distance < 3 && !(distance === 2 && monster.mnum === PM_GRID_BUG);
    const skipReflected = !!(seen & M_SEEN_REFL) || adjacent;
    const inventory = monster.minvent ?? monster.inventory ?? [];
    const helmet = inventory.find(object => (object.owornmask ?? 0) & W_ARMH);
    let choice: MonsterOffensiveChoice | null = null;

    // Each native nomore() skips the rest of this inventory entry. Keep those
    // boundaries: later objects may replace a choice only before its check.
    for (const object of inventory) {
        const charged = object.spe > 0;
        if (!skipReflected) {
            if (choice?.object.otyp === WAN_DEATH) continue;
            if (object.otyp === WAN_DEATH && charged && !(seen & M_SEEN_MAGR))
                choice = { kind: 'ray-wand', object };
            if (choice?.object.otyp === WAN_SLEEP) continue;
            if (object.otyp === WAN_SLEEP && charged && !heroHasInvoluntaryDelay(state) && !(seen & M_SEEN_SLEEP))
                choice = { kind: 'ray-wand', object };
            if (choice?.object.otyp === WAN_FIRE) continue;
            if (object.otyp === WAN_FIRE && charged && !(seen & M_SEEN_FIRE))
                choice = { kind: 'ray-wand', object };
            if (choice?.object.otyp === FIRE_HORN) continue;
            if (object.otyp === FIRE_HORN && charged && speciesCanBlow(monster.mnum) && !(seen & M_SEEN_FIRE))
                choice = { kind: 'horn', object };
            if (choice?.object.otyp === WAN_COLD) continue;
            if (object.otyp === WAN_COLD && charged && !(seen & M_SEEN_COLD))
                choice = { kind: 'ray-wand', object };
            if (choice?.object.otyp === FROST_HORN) continue;
            if (object.otyp === FROST_HORN && charged && speciesCanBlow(monster.mnum) && !(seen & M_SEEN_COLD))
                choice = { kind: 'horn', object };
            if (choice?.object.otyp === WAN_LIGHTNING) continue;
            if (object.otyp === WAN_LIGHTNING && charged && !(seen & M_SEEN_ELEC))
                choice = { kind: 'ray-wand', object };
            if (choice?.object.otyp === WAN_MAGIC_MISSILE) continue;
            if (object.otyp === WAN_MAGIC_MISSILE && charged && !(seen & M_SEEN_MAGR))
                choice = { kind: 'ray-wand', object };
        }
        if (choice?.object.otyp === WAN_UNDEAD_TURNING) continue;
        if (object.otyp === WAN_UNDEAD_TURNING && charged && undeadTurningHasCorpse(monster, state))
            choice = { kind: 'immediate-wand', object };
        if (choice?.object.otyp === WAN_STRIKING) continue;
        if (object.otyp === WAN_STRIKING && charged && !(seen & M_SEEN_MAGR))
            choice = { kind: 'immediate-wand', object };
        if (choice?.object.otyp === WAN_TELEPORTATION) continue;
        if (object.otyp === WAN_TELEPORTATION && charged && !heroControlsTeleport(state)
            && (!monsterTeleportRestricted(monster, state)
                || !((monster.mtrapseen ?? 0) & (1 << (TELEP_TRAP - 1))))
            && (monsterIsScaredAt(monster, state, state.u.ux, state.u.uy)
                || heroBehindChokepoint(monster, state) && monsterHasFriends(monster, state)
                || monsterLikesObjectPileAt(monster, state.u.ux, state.u.uy, state)
                || heroStandsOnStairway(state)))
            choice = { kind: 'immediate-wand', object };
        if (choice?.object.otyp === POT_PARALYSIS) continue;
        if (object.otyp === POT_PARALYSIS && !heroHasInvoluntaryDelay(state))
            choice = { kind: 'potion', object };
        if (choice?.object.otyp === POT_BLINDNESS) continue;
        if (object.otyp === POT_BLINDNESS && !attacks.some(([method]) => method === AT_GAZE))
            choice = { kind: 'potion', object };
        if (choice?.object.otyp === POT_CONFUSION) continue;
        if (object.otyp === POT_CONFUSION)
            choice = { kind: 'potion', object };
        if (choice?.object.otyp === POT_SLEEPING) continue;
        if (object.otyp === POT_SLEEPING && !(seen & M_SEEN_SLEEP))
            choice = { kind: 'potion', object };
        if (choice?.object.otyp === POT_ACID) continue;
        if (object.otyp === POT_ACID && !(seen & M_SEEN_ACID))
            choice = { kind: 'potion', object };
        if (choice?.object.otyp === SCR_EARTH) continue;
        if (object.otyp === SCR_EARTH
            && (objectIsHardHelmet(helmet) || monster.mconf || monsterIsAmorphous(monster)
                || ((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_WALLWALK)
                || monsterIsNoncorporeal(monster) || monsterIsUnsolid(monster) || !random(10))
            && distance <= 2 && monster.mcansee
            && !((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_NOEYES)
            && !sameLevel(state.u.uz, state.rogue_level)
            && (state.u.uz.dnum !== state.astral_level?.dnum || sameLevel(state.u.uz, state.earth_level)))
            choice = { kind: 'earth-scroll', object };
        if (choice?.object.otyp === EXPENSIVE_CAMERA) continue;
        if (object.otyp === EXPENSIVE_CAMERA
            && ((!heroIsBlind(state) && !heroResistsBlindingLight(state))
                || monsterHatesLight({ mnum: heroSpecies(state) }))
            && distance <= 2 && charged && !random(6))
            choice = { kind: 'camera', object };
    }
    return choice;
}

function heroIsNakedAndUnarmed(state: PlayingGameState): boolean {
    return !(state.uwep || state.u.uwep || state.uarmu || state.u.uarmu
        || state.uarm || state.u.uarm || state.uarmh || state.u.uarmh
        || state.uarms || state.u.uarms || state.uarmg || state.u.uarmg
        || state.uarmc || state.u.uarmc || state.uarmf || state.u.uarmf);
}

// C m_use_undead_turning(): corpses inside carried containers do not count.
function undeadTurningHasCorpse(monster: Monster, state: PlayingGameState): boolean {
    if (state.inventory.some(object => object.otyp === CORPSE)) return true;
    const endX = state.u.ux + Math.sign((monster.mux ?? 0) - monster.mx) * 3;
    const endY = state.u.uy + Math.sign((monster.muy ?? 0) - monster.my) * 3;
    const dx = endX - monster.mx, dy = endY - monster.my;
    if ((!dx && !dy) || (dx && dy && Math.abs(dx) !== Math.abs(dy))
        || Math.max(Math.abs(dx), Math.abs(dy)) >= BOLT_LIM) return false;
    let x = monster.mx, y = monster.my;
    do {
        x += Math.sign(dx);
        y += Math.sign(dy);
        if (blockingTerrain(state, x, y)) return false;
        if ((state.level.objects[x]?.[y] ?? []).some(object => object.otyp === CORPSE))
            return true;
    } while (x !== endX || y !== endY);
    return false;
}

function heroBehindChokepoint(monster: Monster, state: PlayingGameState): boolean {
    const dx = Math.sign(monster.mx - (monster.mux ?? 0));
    const dy = Math.sign(monster.my - (monster.muy ?? 0));
    const x = (monster.mux ?? 0) + dx, y = (monster.muy ?? 0) + dy;
    // Turning twice in the eight-direction ring rotates by ninety degrees.
    const leftX = x - dy, leftY = y + dx;
    const rightX = x + dy, rightY = y - dx;
    return (!isok(leftX, leftY) || !isAccessibleAt(leftX, leftY, state))
        && (!isok(rightX, rightY) || !isAccessibleAt(rightX, rightY, state));
}

function monsterHasFriends(monster: Monster, state: PlayingGameState): boolean {
    if (monster.mtame || monster.mpeaceful) return false;
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            const x = monster.mx + dx, y = monster.my + dy;
            if (!isok(x, y)) continue;
            const friend = monsterAtPosition(state.level, x, y);
            if (friend && friend !== monster && !friend.mtame && !friend.mpeaceful) return true;
        }
    }
    return false;
}

function monsterLikesObjectPileAt(
    monster: Monster, x: number, y: number, state: PlayingGameState,
): boolean {
    if (!isok(x, y)) return false;
    const pile = state.level.objects[x]?.[y] ?? [];
    for (const object of pile.slice(0, 3))
        if (monsterWantsFloorObject(monster, object, state)) return true;
    // The native loop counts three examined stacks, even if no fourth exists.
    return pile.length >= 3;
}

function heroStandsOnStairway(state: PlayingGameState): boolean {
    for (let stair = state.stairs; stair; stair = stair.next)
        if (stair.sx === state.u.ux && stair.sy === state.u.uy) return true;
    return false;
}

function sameLevel(left: DungeonLocation, right: DungeonLocation | null | undefined): boolean {
    return !!right && left.dnum === right.dnum && left.dlevel === right.dlevel;
}
