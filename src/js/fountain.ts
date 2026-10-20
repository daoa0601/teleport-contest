// Fountain drying, warnings, and water effects.
// C refs: fountain.c dryup()/dogushforth() and sit.c dosit().

import { monsterHasMapPosition } from './monster_location.js';
import { DOOR, FOUNTAIN, F_WARNED, MON_FLOOR, POOL, ROOM, SDOOR } from './const.js';
import { monsterArmName, monsterHeadName } from './body_parts.js';
import { glyphAt, newsym, plineWithContinuation } from './display.js';
import { deleteEngravingAt } from './engrave.js';
import { game, requireLiveGame, requireGameLevel } from './gstate.js';
import type { GameState } from './game_state.js';
import type { MessagePublisher } from './display.js';
import { countLevelFeatures, deleteFloorTrap, splitHeroMonsterForm } from './mklev.js';
import { resolveMonsterLiquid } from './mon.js';
import { angerWatchGuards } from './monster_anger.js';
import { MONSTER_FLAGS1 } from './monster_data.js';
import { finishLiquidDeathForCurrentMover } from './hero_monster_death.js';
import { monsterName, monsterPossessive } from './monster_name.js';
import { BOULDER } from './object_data.js';
import { makePlural } from './object_grammar.js';
import { promptYesNo } from './query.js';
import { inTown } from './room.js';
import { rn2 } from './rng.js';
import { heroIsDeaf } from './senses.js';
import { waterDamageChain } from './trap.js';
import { cansee, clearAreaCells, couldsee } from './vision.js';

const PM_WATCHMAN = 282;
const PM_WATCH_CAPTAIN = 283;
const M1_NOLIMBS = 0x00006000;

export async function dryFountainAt(x: number, y: number, {
    causedByHero = true, random = rn2, state = game,
    publish = plineWithContinuation,
}: { causedByHero?: boolean; random?: (limit: number) => number; state?: GameState; publish?: MessagePublisher } = {}): Promise<boolean> {
    requireLiveGame(state);
    const level = requireGameLevel(state);
    const location = level.at(x, y);
    if (location?.typ !== FOUNTAIN) return false;
    const dries = random(3) === 0;
    const alreadyWarned = !!((location.looted ?? 0) & F_WARNED);
    if (!dries && !alreadyWarned) return false;

    if (causedByHero && inTown(level, x, y) && !alreadyWarned) {
        location.looted = (location.looted ?? 0) | F_WARNED;
        await warnAboutFountain(state, publish);
        return false;
    }
    if (causedByHero && state.flags.debug
        && await promptYesNo('Dry up fountain?') === 'n') return false;

    if (cansee(x, y)) {
        const glyph = glyphAt(x, y, state);
        if (glyph?.kind !== 'terrain' || glyph.terrainName !== 'cloud')
            await publish('The fountain dries up!');
    }
    location.typ = ROOM;
    countLevelFeatures(state);
    location.flags = 0;
    location.looted = 0;
    location.blessedftn = 0;
    newsym(x, y);
    if (causedByHero && inTown(level, x, y))
        await angerWatchGuards(false, { publish });
    return true;
}

async function warnAboutFountain(state: GameState, publish: MessagePublisher): Promise<void> {
    const watch = [...requireGameLevel(state).monsters].reverse().find(monster =>
        !monster.dead && monster.mhp > 0 && monster.mpeaceful
        && (monster.mstate ?? MON_FLOOR) === MON_FLOOR
        && (monster.mnum === PM_WATCHMAN || monster.mnum === PM_WATCH_CAPTAIN)
        && couldsee(monster.mx, monster.my));
    if (!watch) {
        await publish('The flow reduces to a trickle.');
        return;
    }
    const name = monsterName(watch, { article: 'a', capitalized: true, state });
    if (heroIsDeaf(state)) {
        const limbless = ((MONSTER_FLAGS1[watch.mnum] ?? 0) & M1_NOLIMBS) === M1_NOLIMBS;
        const part = limbless ? monsterHeadName(watch.mnum)
            : makePlural(monsterArmName(watch.mnum));
        await publish(`${name} earnestly ${limbless ? 'shakes' : 'waves'} ${
            monsterPossessive(watch, { state })} ${part}!`);
    } else {
        await publish(`${name} yells:`);
        await publish('"Hey, stop using that fountain!"');
    }
}

export async function splitSittingGremlin() {
    const clone = await splitHeroMonsterForm(game);
    if (!clone) return null;
    await plineWithContinuation('You multiply!');
    await dryFountainAt(game.u.ux, game.u.uy);
    return clone;
}

// Gushing water along line of sight from an overflowing fountain.
// C refs: fountain.c dogushforth() and gush().
export async function gushForthFromFountain({ drinking = false, state = game }: { drinking?: boolean; state?: GameState } = {}): Promise<void> {
    const level = requireGameLevel(state);
    const ux = state.u.ux;
    const uy = state.u.uy;
    let madePool = 0;
    for (const { x, y } of clearAreaCells(ux, uy, 7)) {
        if (((x + y) % 2) || (x === ux && y === uy)
            || rn2(1 + distmin(ux, uy, x, y))) continue;
        const location = state.level?.at?.(x, y);
        const objects = state.level?.objects?.[x]?.[y] || [];
        if (location?.typ !== ROOM || objects.some(object => object.otyp === BOULDER)
            || nextToDoor(x, y, state)) {
            continue;
        }
        const trap = state.level?.traps?.find(candidate =>
            candidate.tx === x && candidate.ty === y);
        if (trap && !await deleteFloorTrap(trap, state)) continue;

        if (madePool++ === 0) {
            await plineWithContinuation('Water gushes forth from the overflowing fountain!');
        }
        location.typ = POOL;
        location.flags = 0;
        deleteEngravingAt(x, y, level);
        await waterDamageChain(objects, [], state, { publish: plineWithContinuation });

        const monster = (state.level?.monsters || []).find(candidate => monsterHasMapPosition(candidate, state) &&
            (candidate.mhp ?? 1) > 0 && candidate.mx === x && candidate.my === y);
        if (monster) {
            await resolveMonsterLiquid(monster, state, {
                announce: plineWithContinuation,
                finishDeath: finishLiquidDeathForCurrentMover,
                monsterMoving: !!state.context.mon_moving,
            });
        } else {
            newsym(x, y);
        }
    }
    if (!madePool) {
        await plineWithContinuation(drinking
            ? 'Your thirst is quenched.'
            : 'Water sprays all over you.');
    }
}

function distmin(x1: number, y1: number, x2: number, y2: number): number {
    return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
}

function nextToDoor(x: number, y: number, state: GameState): boolean {
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            const typ = state.level?.at?.(x + dx, y + dy)?.typ;
            if (typ === DOOR || typ === SDOOR) return true;
        }
    }
    return false;
}
