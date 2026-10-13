// C teleport.c:level_tele() and random_teleport_level().
import { buriedBallToPunishment } from './buried_object.js';
import { chooseWizardLevelDestination } from './cmd.js';
import { In_endgame, In_mines, In_quest, In_sokoban, TT_BURIEDBALL } from './const.js';
import { flushPendingTopline, plineWithContinuation } from './display.js';
import { levelAtDepth } from './dungeon.js';
import { finishHeroDeath } from './end.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import type { GameState, PlayingGameState } from './game_state.js';
import type { Dungeon, DungeonLocation } from './dungeon_types.js';
import { depth } from './hacklib.js';
import { heroSpecies } from './hero_species.js';
import { gotoLevel as changeLevel } from './level_change.js';
import { MONSTER_SOUND } from './monster_data.js';
import { propertyIsActive } from './properties.js';
import { getLine, promptYesNoQuit } from './query.js';
import { rn2, rnd, rnl } from './rng.js';
import { leaveHeroShop } from './shop_departure.js';
import { bringLeashedFollowers, heroControlsTeleport } from './teleport.js';
import { surfaceName } from './terrain_name.js';

const shudder = 'You shudder for a moment.';

export type LevelChange = (...args: Parameters<typeof changeLevel>) => unknown;

type LevelRequest =
    | { random: true; depth?: never; destination?: never; preArrivalMessage?: never }
    | { random?: false; depth: number; destination?: never; preArrivalMessage?: never }
    | { random?: false; depth?: never; destination: DungeonLocation; preArrivalMessage?: string | null };

export async function levelTeleport({ state = game, gotoLevel = changeLevel,
    menuRequested = false }: {
    state?: GameState; gotoLevel?: LevelChange; menuRequested?: boolean;
} = {}): Promise<void> {
    requireLiveGame(state);
    requirePlayingGame(state);
    const hero = state.u;
    const wizard = !!state.flags.debug;
    if (state.iflags.debug_fuzzer) {
        let dnum;
        do dnum = rn2(state.dungeons.length);
        while (dnum === state.astral_level?.dnum || dungeonAt(state, dnum).flags.unconnected
            || !dungeonAt(state, dnum).num_dunlevs);
        hero.ucamefrom = { ...hero.uz };
        await gotoLevel({ dnum, dlevel: 1 + rn2(dungeonAt(state, dnum).num_dunlevs) });
        return;
    }
    if ((hero.uhave?.amulet || In_endgame(hero.uz) || In_sokoban(hero.uz)) && !wizard) {
        await plineWithContinuation('You feel very disoriented for a moment.');
        return;
    }

    const controlled = (heroControlsTeleport(state)
        && !(hero.stunned || (hero.stunnedTurns ?? 0) > 0)) || wizard;
    const request: LevelRequest | null = controlled
        ? await readLevelRequest(state, menuRequested) : { random: true };
    if (!request) return;
    let newDepth = request.depth;
    const forced = request.destination;
    if (request.random) {
        newDepth = randomTeleportDepth(state);
        if (newDepth === depth(hero.uz)) {
            await plineWithContinuation(shudder);
            return;
        }
    } else if (!forced) {
        if (newDepth === undefined) throw new Error('Controlled level teleport has no requested depth');
        if (newDepth === 0) {
            await teleportToNowhere(state);
            return;
        }
        if (atKnox(state) && newDepth > 0) {
            await plineWithContinuation(shudder);
            return;
        }
        if (In_quest(hero.uz) && newDepth > 0)
            newDepth += dungeonAt(state, hero.uz.dnum).depth_start - 1;
    }

    if (hero.utrap && hero.utraptype === TT_BURIEDBALL)
        await buriedBallToPunishment(state);
    if (!(await bringLeashedFollowers(state)) && !forced) {
        await plineWithContinuation(shudder);
        return;
    }
    if (In_endgame(hero.uz) && !forced) {
        if (newDepth === undefined) throw new Error('Endgame teleport has no requested depth');
        const levels = dungeonAt(state, hero.uz.dnum).num_dunlevs;
        if (newDepth >= 0 || newDepth <= -levels) {
            await plineWithContinuation("You can't get there from here.");
            return;
        }
        await gotoLevel({ dnum: hero.uz.dnum, dlevel: levels + newDepth });
        return;
    }
    if (newDepth !== undefined && newDepth < 0 && !forced) {
        await teleportAboveDungeon(newDepth, state, gotoLevel);
        return;
    }

    if (!forced && newDepth === undefined) throw new Error('Level teleport has no destination');
    const destination = forced || (newDepth !== undefined
        ? await destinationAtDepth(newDepth, state) : null);
    if (!destination || sameLevel(destination, hero.uz)) return;
    await gotoLevel({ dnum: destination.dnum, dlevel: destination.dlevel }, {
        arrival: 'random', preArrivalMessage: request.preArrivalMessage || '',
        postMessage: state.flags.verbose ? 'You materialize on a different level!' : '',
    });
}

async function readLevelRequest(state: PlayingGameState, menuRequested: boolean): Promise<LevelRequest | null> {
    const wizard = !!state.flags.debug;
    menuRequested ||= !!state.iflags.menu_requested;
    state.iflags.menu_requested = false;
    if (menuRequested && wizard) return chooseWizardLevelDestination();
    for (let attempt = 1; attempt <= 10; attempt++) {
        const help = attempt > 1
            ? wizard ? ' [type a number, name, or ? for a menu]' : ' [type a number or name]'
            : '';
        const text = await getLine(`To what level do you want to teleport?${help}`,
            character => character >= ' ');
        if (text === '*') return { random: true };
        // A confused cancellation can itself be misread as random teleport.
        if ((state.u.confused || (state.u.confusionTurns ?? 0) > 0) && rnl(5)) {
            await plineWithContinuation('Oops...');
            return { random: true };
        }
        if (text === null) return null;
        if (wizard && text === '?') return chooseWizardLevelDestination();
        const requested = levelDepthByName(text, state) || Number.parseInt(text, 10) || 0;
        if (requested || /^-?\d/.test(text))
            return !requested && attempt === 10 ? { random: true } : { depth: requested };
    }
    return { random: true };
}

// The 1-in-5 no-op is evaluated even in branches which forbid random travel.
export function randomTeleportDepth(state: GameState = game, random = rn2, rollOne = rnd): number {
    requirePlayingGame(state);
    const hero = state.u;
    const current = depth(hero.uz, state.dungeons);
    const dungeon = dungeonAt(state, hero.uz.dnum);
    if (!random(5) || dungeon.num_dunlevs === 1 || In_endgame(hero.uz)) return current;
    let minimum = 1;
    let maximum = dungeon.depth_start + dungeon.num_dunlevs - 1;
    if (In_quest(hero.uz)) {
        minimum = dungeon.depth_start;
        const locate = requiredSpecialLevel(state, 'x-loca');
        if (dungeon.dunlev_ureached < locate.dlevel)
            maximum = minimum + locate.dlevel - 1;
    } else if (dungeon.flags?.hellish && !hero.uevent?.invoked) maximum--;
    let destination = random(current + 3 - minimum) + minimum;
    if (destination >= current) destination++;
    if (destination > maximum) {
        destination = maximum;
        if (hero.uz.dlevel === dungeon.num_dunlevs) destination -= rollOne(3);
    }
    if (destination < minimum) {
        destination = minimum;
        if (destination === current) destination = Math.min(maximum, destination + rollOne(3));
    }
    return destination;
}

function atKnox(state: GameState): boolean {
    return sameLevel(state.u.uz, state.knox_level);
}

function sameLevel(left: DungeonLocation | null | undefined, right: DungeonLocation | null | undefined): boolean {
    return !!left && !!right && left.dnum === right.dnum && left.dlevel === right.dlevel;
}

async function destinationAtDepth(requested: number, state: PlayingGameState): Promise<DungeonLocation | null> {
    const hero = state.u;
    const dungeon = dungeonAt(state, hero.uz.dnum);
    if (hero.uz.dnum === state.medusa_level?.dnum
        && requested >= dungeon.depth_start + dungeon.num_dunlevs) {
        const valley = state.valley_level;
        if (!valley) throw new Error('The dungeon graph has no Gehennom entrance');
        return { dnum: valley.dnum, dlevel: 1 };
    }
    const bottom = In_quest(hero.uz) ? requiredSpecialLevel(state, 'x-strt')
        : In_mines(hero.uz) ? requiredSpecialLevel(state, 'minend') : state.sanctum_level;
    const bottomDungeon = dungeonAt(state, bottom?.dnum ?? hero.uz.dnum);
    const deepest = bottomDungeon.depth_start + bottomDungeon.num_dunlevs - 1;
    if (!state.flags.debug && dungeon.flags?.hellish
        && !hero.uevent?.invoked && requested >= deepest) {
        requested = deepest - 1;
        await plineWithContinuation('Sorry...');
    }
    if (In_quest(hero.uz)) requested = Math.max(requested, depth(requiredSpecialLevel(state, 'x-strt')));
    const destination = levelAtDepth(requested, { state });
    if (sameLevel(destination, hero.uz) && requested !== depth(hero.uz)) {
        await plineWithContinuation(`You can't get there from ${requested > deepest ? 'anywhere' : 'here'}.`);
        return null;
    }
    return destination;
}

// C dungeon.c:lev_by_name(): names require an actually visited level and
// can address only this branch or the main-dungeon/Gehennom connection.
export function levelDepthByName(input: string, state: GameState = game): number {
    requirePlayingGame(state);
    let name = input.toLowerCase();
    let target: DungeonLocation | undefined;
    for (const [key, annotation] of state._levelAnnotations || []) {
        if (annotation.toLowerCase() !== name) continue;
        const [dnum, dlevel] = key.split(':').map(Number);
        if (dnum === undefined || dlevel === undefined
            || !Number.isInteger(dnum) || !Number.isInteger(dlevel))
            throw new Error(`Invalid level annotation identity ${key}`);
        target = { dnum, dlevel };
        break;
    }
    if (!target) {
        name = name.replace(/^the /, '').replace(/ level$/, '');
        if (name === 'hell' || name === 'gehennom')
            name = state.u.uz.dnum === state.tower_dnum ? " to vlad's tower" : 'valley';
        if (name === 'delphi') name = 'oracle';
        for (const [key, special] of state.specialLevels || []) {
            if (key.toLowerCase() === name) { target = special; break; }
        }
    }
    const visited = (level: DungeonLocation) => state.flags.debug || sameLevel(level, state.u.uz)
        || state._levelCache?.has(`${level.dnum}:${level.dlevel}`);
    const inBranch = (level: DungeonLocation) => level.dnum === state.u.uz.dnum
        || (state.u.uz.dnum === state.valley_level?.dnum && level.dnum === state.medusa_level?.dnum)
        || (state.u.uz.dnum === state.medusa_level?.dnum && level.dnum === state.valley_level?.dnum);
    if (target) return inBranch(target) && visited(target) ? depth(target) : 0;
    if (name.includes(' to ')) name = name.slice(name.lastIndexOf(' to ') + 4);
    const branch = state.branches?.find(candidate => {
        const dungeonName = state.dungeons[candidate.end2.dnum]?.dname.toLowerCase();
        return dungeonName === name || dungeonName?.replace(/^the /, '') === name;
    });
    if (!branch || !visited(branch.end1) || !visited(branch.end2)) return 0;
    target = branch.end2.dnum === state.u.uz.dnum ? branch.end2 : branch.end1;
    return inBranch(target) ? depth(target) : 0;
}

async function teleportToNowhere(state: PlayingGameState): Promise<void> {
    if (await promptYesNoQuit('Go to Nowhere.  Are you sure?') !== 'y') return;
    const action = MONSTER_SOUND[heroSpecies(state)] === 0 ? 'writhe' : 'scream';
    await plineWithContinuation(`You ${action} in agony as your body begins to warp...`);
    await flushPendingTopline();
    await plineWithContinuation('You cease to exist.');
    if (state.inventory.length)
        await plineWithContinuation(`Your possessions land on the ${surfaceName(state.u.ux, state.u.uy, state)} with a thud.`);
    if (await finishHeroDeath({ killer: 'committed suicide', deathCause: 'committed suicide',
        deathLineShown: true })) return;
    await plineWithContinuation('An energized cloud of dust begins to coalesce.');
    await plineWithContinuation(`Your body rematerializes${state.inventory.length ? ', and you gather up all your possessions' : ''}.`);
}

async function teleportAboveDungeon(destination: number, state: PlayingGameState, gotoLevel: LevelChange): Promise<void> {
    if (state.u.ushops0?.length) {
        const generating = state.in_mklev;
        state.in_mklev = true;
        try {
            await leaveHeroShop(state.u.ushops0, { newLevel: true, state });
            state.u.ushops0 = [];
            state.u.ushops = [];
        } finally {
            if (generating === undefined) delete state.in_mklev;
            else state.in_mklev = generating;
        }
    }
    let killer = null;
    if (destination <= -10) {
        await plineWithContinuation('You arrive in heaven.');
        await plineWithContinuation('"Thou art early, but we\'ll admit thee."');
        killer = 'went to heaven prematurely';
    } else if (destination === -9) {
        await plineWithContinuation('You feel deliriously happy.');
        await plineWithContinuation("(In fact, you're on Cloud 9!)");
        await flushPendingTopline();
    } else await plineWithContinuation('You are now high above the clouds...');
    let escape;
    if (!killer) {
        if (propertyIsActive('levitation', state)) escape = 'float gently down to earth';
        else if (propertyIsActive('flying', state)) escape = 'fly down to the ground';
        else {
            await plineWithContinuation("Unfortunately, you don't know how to fly.");
            await plineWithContinuation('You plummet a few thousand feet to your death.');
            killer = `teleported out of the dungeon and fell to ${state.flags.female ? 'her' : 'his'} death`;
        }
    }
    if (killer) {
        const previous = state.u.uz;
        state.u.uz = { dnum: 0, dlevel: destination <= -10 ? -10 : 0 };
        if (await finishHeroDeath({ killer, deathCause: killer, deathLineShown: true })) return;
        state.u.uz = previous;
        escape = 'find yourself back on the surface';
    }
    await plineWithContinuation(`You ${escape}.`);
    await gotoLevel({ dnum: 0, dlevel: 0 });
}

function dungeonAt(state: GameState, dnum: number): Dungeon {
    const dungeon = state.dungeons[dnum];
    if (!dungeon) throw new Error(`Level teleport cannot find dungeon ${dnum}`);
    return dungeon;
}

function requiredSpecialLevel(state: GameState, name: string): DungeonLocation {
    const level = state.specialLevels?.get(name);
    if (!level) throw new Error(`Level teleport cannot find special level ${name}`);
    return level;
}
