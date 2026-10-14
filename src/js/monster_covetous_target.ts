// Artifact selection and pursuit for covetous monsters.
// C wizard.c:strategy(), target_on(), and tactics()'s target branches.
import { artifactById } from './artifacts.js';
import {
    isok, RLOC_MSG, STRAT_APPEARMSG, STRAT_GROUND, STRAT_HEAL, STRAT_MONSTR,
    STRAT_PLAYER, STRAT_WAITMASK,
} from './const.js';
import { plineWithContinuation } from './display.js';
import { remove_object } from './floor_object.js';
import type { PlayingGameState } from './game_state.js';
import type { Position } from './map_types.js';
import { addObjectToMonsterInventory } from './monster_inventory.js';
import { MONSTER_FLAGS3, MONSTER_NAME } from './monster_data.js';
import { monsterAtPosition } from './monster_location.js';
import { monsterName } from './monster_name.js';
import type { Monster } from './monster_types.js';
import { observeDistantObjectForNaming } from './objnam.js';
import { objectDescription } from './object_description.js';
import { AMULET_OF_YENDOR, BELL_OF_OPENING, CANDELABRUM_OF_INVOCATION,
    SPE_BOOK_OF_THE_DEAD } from './object_data.js';
import type { GameObject } from './object_types.js';
import { priestIsInOwnTemple } from './priest.js';
import { shopkeeperInOwnShop } from './shk.js';
import { mnearto } from './shop_damage.js';
import { relocateMonsterTo } from './teleport.js';
import { monsterTeleportRestricted } from './teleport_rules.js';
import { cansee } from './vision.js';

const WANTS_AMULET = 1;
const WANTS_BELL = 2;
const WANTS_BOOK = 4;
const WANTS_CANDELABRUM = 8;
const WANTS_ARTIFACT = 16;

type CovetousTarget =
    | { kind: 'hero'; position: Position; mask: number }
    | { kind: 'floor'; position: Position; mask: number; object: GameObject }
    | { kind: 'monster'; position: Position; mask: number };
type CovetousStrategy =
    | { kind: 'heal' }
    | { kind: 'harass' }
    | { kind: 'target'; target: CovetousTarget };

interface CovetousDecision { strategy: CovetousStrategy; goal: Position | undefined }

export function chooseCovetousStrategy(monster: Monster, state: PlayingGameState): CovetousStrategy {
    const { strategy, goal } = decideCovetousStrategy(monster, state);
    if (goal) monster.mgoal = goal;
    const target = strategy.kind === 'target' ? strategy.target : null;
    const flags = strategy.kind === 'heal' ? STRAT_HEAL
        : target ? target.mask | (target.kind === 'hero' ? STRAT_PLAYER
            : target.kind === 'floor' ? STRAT_GROUND : STRAT_MONSTR) : 0;
    monster.mstrategy = ((monster.mstrategy ?? 0) & (STRAT_WAITMASK | STRAT_APPEARMSG)) | flags;
    return strategy;
}

function decideCovetousStrategy(monster: Monster, state: PlayingGameState): CovetousDecision {
    if (shopkeeperInOwnShop(monster, state) || priestIsInOwnTemple(monster, state))
        return { strategy: { kind: 'harass' }, goal: undefined };
    const health = Math.trunc(monster.mhp * 3 / monster.mhpmax);
    if (health < 1 || health > 3 || health === 1 && MONSTER_NAME[monster.mnum] !== 'Wizard of Yendor')
        return { strategy: { kind: 'heal' }, goal: undefined };
    const masks = state.context.made_amulet ? [WANTS_AMULET] : [];
    masks.push(...(state.u.uevent?.invoked
        ? [WANTS_ARTIFACT, WANTS_BOOK, WANTS_BELL, WANTS_CANDELABRUM]
        : [WANTS_BOOK, WANTS_BELL, WANTS_CANDELABRUM, WANTS_ARTIFACT]));
    let goal: Position | undefined;
    for (const mask of masks) {
        if (!((MONSTER_FLAGS3[monster.mnum] ?? 0) & mask)) continue;
        const target = findCovetousTarget(monster, mask, state);
        if (target) {
            return { strategy: { kind: 'target', target }, goal: { ...target.position } };
        }
        goal = { x: 0, y: 0 };
    }
    return { strategy: { kind: health < 3 ? 'heal' : 'harass' }, goal };
}

function findCovetousTarget(monster: Monster, mask: number, state: PlayingGameState): CovetousTarget | null {
    if (!((MONSTER_FLAGS3[monster.mnum] ?? 0) & mask)) return null;
    const matches = (object: GameObject) => objectMatchesTarget(object, mask, state);
    if (!(monster.minvent ?? []).some(matches)) {
        if (heroHasTarget(mask, state))
            return { kind: 'hero', position: { x: state.u.ux, y: state.u.uy }, mask };
        const floor = state.level.objects.flatMap(column =>
            (column ?? []).flatMap(pile => pile ?? []))
            .filter(matches).sort((a, b) => (b._fobjOrder ?? 0) - (a._fobjOrder ?? 0))[0];
        if (floor) return { kind: 'floor', position: { x: floor.ox, y: floor.oy }, mask, object: floor };
        // other_mon_has_arti() considers the first fmon carrier before the
        // Amulet exception; it does not search past an excluded carrier.
        const carrier = [...state.level.monsters].reverse().find(candidate =>
            candidate !== monster && (candidate.minvent ?? []).some(matches));
        if (carrier && (mask !== WANTS_AMULET || !carrier.iswiz && !priestIsInOwnTemple(carrier, state)))
            return { kind: 'monster', position: { x: carrier.mx, y: carrier.my }, mask };
    }
    return null;
}

function objectMatchesTarget(object: GameObject, mask: number, state: PlayingGameState): boolean {
    if (mask === WANTS_AMULET) return object.otyp === AMULET_OF_YENDOR;
    if (mask === WANTS_BELL) return object.otyp === BELL_OF_OPENING;
    if (mask === WANTS_BOOK) return object.otyp === SPE_BOOK_OF_THE_DEAD;
    if (mask === WANTS_CANDELABRUM) return object.otyp === CANDELABRUM_OF_INVOCATION;
    return !!object.questArtifact || !!artifactById(object.oartifact, state)?.questArtifact;
}

function heroHasTarget(mask: number, state: PlayingGameState): boolean {
    const owns = state.u.uhave;
    if (mask === WANTS_AMULET) return !!owns?.amulet;
    if (mask === WANTS_BELL) return !!owns?.bell;
    if (mask === WANTS_BOOK) return !!owns?.book;
    if (mask === WANTS_CANDELABRUM) return !!owns?.menorah;
    return !!owns?.questart;
}

export async function pursueCovetousTarget(monster: Monster, target: CovetousTarget,
    state: PlayingGameState): Promise<'continued' | 'blocked-ground'> {
    const { x, y } = target.position;
    if (!target.mask || !isok(x, y)) return 'continued';
    const restricted = monsterTeleportRestricted(monster, state);
    if (restricted && Math.max(Math.abs(monster.mx - x), Math.abs(monster.my - y)) > 1)
        return 'continued';
    if (target.kind === 'hero' || x === state.u.ux && y === state.u.uy) {
        await approachTarget(monster, x, y, restricted, state);
        return 'continued';
    }
    if (target.kind === 'floor') {
        const occupant = monsterAtPosition(state.level, x, y);
        if (occupant && occupant !== monster)
            return 'blocked-ground';
        await relocateMonsterTo(monster, x, y, { state });
        if (cansee(monster.mx, monster.my)) {
            const subject = monsterName(monster, { state, capitalized: true });
            observeDistantObjectForNaming(target.object, state);
            const object = objectDescription(target.object, { state });
            await plineWithContinuation(`${subject} picks up ${object}.`);
        }
        remove_object(target.object, state);
        await addObjectToMonsterInventory(monster, target.object, state, { atFront: true });
        return 'continued';
    }
    await approachTarget(monster, x, y, restricted, state);
    return 'continued';
}

async function approachTarget(monster: Monster, x: number, y: number,
    restricted: boolean, state: PlayingGameState): Promise<void> {
    const oldx = monster.mx, oldy = monster.my;
    if (restricted || !await mnearto(monster, x, y, state, { flags: RLOC_MSG }))
        await relocateMonsterTo(monster, oldx, oldy, { state });
}
