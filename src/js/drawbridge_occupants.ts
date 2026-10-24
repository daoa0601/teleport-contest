// Occupants caught by a moving drawbridge.
// C ref: dbridge.c do_entity(), e_missed(), e_jumps(), e_survives_at().

import { monsterAtPosition, placeMonsterAt } from './monster_location.js';
import { heroIsUnaware } from './hero_sleep.js';
import { isDrawbridgeWallAt, isLavaAt, isPoolAt, isPoolOrLavaAt } from './terrain_properties.js';
import {
    CRUSHING, DRAWBRIDGE_DOWN, IS_DRAWBRIDGE, KILLED_BY_AN, MOAT, NO_KILLER_PREFIX,
} from './const.js';
import {
    canSeeMonster, canSpotMonster, displayLiquidName, plineWithContinuation,
} from './display.js';
import { finishHeroDeath } from './end.js';
import { finishHeroMonsterKill, finishLiquidDeathForCurrentMover } from './hero_monster_death.js';
import { heroLiquidEffects } from './hack.js';
import { resolveMonsterLiquid } from './mon.js';
import {
    MONSTER_FLAGS1, MONSTER_MOVE, MONSTER_NAME, MONSTER_SYMBOL,
} from './monster_data.js';
import {
    finishMonsterKilled,
} from './monster_death.js';
import { AD_DGST, AD_PHYS } from './monster_attack_types.js';
import { heroIsAmphibious, heroIsBreathless, heroSpecies } from './hero_species.js';
import { heroHasWaterWalking } from './armor.js';
import { finishDestinationSpotEffects, finishTeleportArrival } from './location_effects.js';
import { publishHeardMessage } from './hero_speech.js';
import { heroIsDeaf, heroIsHallucinating } from './senses.js';
import { verbForSubject } from './object_grammar.js';
import { rnd } from './rng.js';
import { updateMonsterRegions } from './regions.js';
import { moveHeroByTeleport } from './teleport.js';
import { findNearbyMonsterPosition } from './teleport_rules.js';
import type { GameState } from './game_state.js';
import type { Hero } from './hero_types.js';
import type { Monster } from './monster_types.js';
import type { MapLocation, Position } from './map_types.js';
import type { DrawbridgeOptions, DrawbridgeSquare } from './drawbridge_terrain.js';
import { monsterName, monsterSubjectPronoun } from './monster_name.js';

type DrawbridgeEntity = Position & { species: number; active: boolean } & (
    { hero: true; actor: Hero } | { hero: false; actor: Monster }
);

interface DrawbridgeDeath {
    showKillMessage: boolean;
    noCorpse: boolean;
}

const M1_FLY = 0x00000001;
const M1_SWIM = 0x00000002;
const M1_WALLWALK = 0x00000008;
const S_EYE = 5;
const S_LIGHT = 25;
const S_GHOST = 54;
const PM_FIRE_ELEMENTAL = 155;
const PM_SALAMANDER = 329;

function entityAt(x: number, y: number, state: GameState): DrawbridgeEntity | null {
    if (state.u.ux === x && state.u.uy === y)
        return { hero: true, actor: state.u, x, y, species: heroSpecies(state), active: true };
    const monster = state.level ? monsterAtPosition(state.level, x, y) : null;
    if (!monster) return null;
    const tail = monster.wormno && (monster.mx !== x || monster.my !== y);
    return { hero: false, actor: monster, x, y, active: true,
        species: tail ? MONSTER_NAME.indexOf('long worm tail') : monster.mnum };
}

function entityFlags(entity: DrawbridgeEntity): number {
    return MONSTER_FLAGS1[entity.species] ?? 0;
}

function entitySymbol(entity: DrawbridgeEntity): number | null {
    return MONSTER_SYMBOL[entity.species] ?? null;
}

function entityName(entity: DrawbridgeEntity, state: GameState, capitalized = false): string {
    if (entity.hero) return capitalized ? 'You' : 'you';
    return monsterName(entity.actor, { state, capitalized });
}

function entityIsVisible(entity: DrawbridgeEntity): boolean {
    return entity.hero || canSeeMonster(entity.actor);
}

function entityPassesWalls(entity: DrawbridgeEntity, state: GameState): boolean {
    if (entity.hero
        && state.u.passesWalls) return true;
    return !!(entityFlags(entity) & M1_WALLWALK);
}

function entityIsNoncorporeal(entity: DrawbridgeEntity): boolean {
    return entitySymbol(entity) === S_GHOST;
}

function entityIsFlying(entity: DrawbridgeEntity): boolean {
    return !!(entityFlags(entity) & M1_FLY);
}

function entityIsFloating(entity: DrawbridgeEntity): boolean {
    const symbol = entitySymbol(entity);
    return symbol === S_EYE || symbol === S_LIGHT;
}

function entityIsHelpless(entity: DrawbridgeEntity): boolean {
    if (entity.hero) return false;
    const monster = entity.actor;
    return !monster.mcanmove || !!monster.msleeping;
}

function entityIsConfused(entity: DrawbridgeEntity, state: GameState): boolean {
    return entity.hero
        ? !!(state.u?.confused || (state.u?.confusionTurns ?? 0) > 0)
        : !!entity.actor.mconf;
}

function entityIsStunned(entity: DrawbridgeEntity, state: GameState): boolean {
    return entity.hero
        ? !!(state.u?.stunned || (state.u?.stunnedTurns ?? 0) > 0)
        : !!entity.actor.mstun;
}

function occupiedLocation(entity: DrawbridgeEntity, state: GameState): MapLocation {
    const location = state.level?.at(entity.x, entity.y);
    if (!location)
        throw new Error(`Drawbridge occupant has no map cell at (${entity.x}, ${entity.y}).`);
    return location;
}

function heroSurvivesPool(state: GameState): boolean {
    const hero = state.u;
    return heroHasWaterWalking(state) || heroIsAmphibious(state)
        || heroIsBreathless(state) || !!(hero.swimming || hero.flying
            || hero.levitating || hero.levitation);
}

function speciesSurvivesPool(entity: DrawbridgeEntity): boolean {
    return !!(entityFlags(entity) & (M1_SWIM | M1_FLY))
        || entityIsFloating(entity);
}

function entitySurvivesAt(entity: DrawbridgeEntity, state: GameState): boolean {
    if (entityIsNoncorporeal(entity)) return true;
    if (isPoolAt(entity.x, entity.y, state)) {
        return (entity.hero && heroSurvivesPool(state)) || speciesSurvivesPool(entity);
    }
    if (isLavaAt(entity.x, entity.y, state)) {
        return (entity.hero && !!(state.u.levitating || state.u.levitation || state.u.flying))
            || entityIsFlying(entity)
            || entity.species === PM_FIRE_ELEMENTAL || entity.species === PM_SALAMANDER;
    }
    if (isDrawbridgeWallAt(entity.x, entity.y, state)) return entityPassesWalls(entity, state);
    return true;
}

function entityAutomaticallyMissed(entity: DrawbridgeEntity, state: GameState): boolean {
    return entityPassesWalls(entity, state)
        || entityIsNoncorporeal(entity);
}

function entityMissed(entity: DrawbridgeEntity, state: GameState, chunks = false): boolean {
    if (entityAutomaticallyMissed(entity, state)) return true;
    let misses = 0;
    const flyingCanReact = entity.hero
        ? !heroIsUnaware(state) : !entityIsHelpless(entity);
    if (entityIsFlying(entity) && flyingCanReact)
        misses = 5;
    else if (entityIsFloating(entity)
        || (entity.hero && (state.u.levitating || state.u.levitation))) misses = 3;
    else if (chunks && isPoolAt(entity.x, entity.y, state)) misses = 2;
    if (isDrawbridgeWallAt(entity.x, entity.y, state)) misses -= 3;
    return misses >= rnd(8);
}

function entityJumps(entity: DrawbridgeEntity, state: GameState): boolean {
    const fumbling = entity.hero && !!(state.u?.fumbling
        || (state.u?.fumblingTurns ?? 0) > 0);
    const immobileMonster = !entity.hero
        && (entityIsHelpless(entity)
            || !(MONSTER_MOVE[entity.actor.mnum] || 0)
            || entity.actor.wormno);
    if ((entity.hero && heroIsUnaware(state))
        || fumbling || immobileMonster)
        return false;
    let chances = 4;
    if (entityIsConfused(entity, state)) chances -= 2;
    if (entityIsStunned(entity, state)) chances -= 3;
    if (isDrawbridgeWallAt(entity.x, entity.y, state)) chances -= 2;
    return chances >= rnd(10);
}

function moveEntity(entity: DrawbridgeEntity, destination: Position, state: GameState): void {
    if (entity.hero) {
        state.u.ux = destination.x;
        state.u.uy = destination.y;
    } else {
        placeMonsterAt(entity.actor, destination.x, destination.y);
        updateMonsterRegions(entity.actor, state);
    }
    entity.x = destination.x;
    entity.y = destination.y;
}

async function moveSurvivingHeroAway(entity: DrawbridgeEntity, state: GameState): Promise<void> {
    if (entitySurvivesAt(entity, state)) return;
    const destination = findNearbyMonsterPosition(entity.species, entity.x, entity.y, { state });
    if (!destination) return;
    await plineWithContinuation(`A ${heroIsHallucinating(state) ? 'normal' : 'strange'} force teleports you away...`);
    const movement = await moveHeroByTeleport(destination.x, destination.y, state);
    await finishTeleportArrival(movement, { announceTeleport: false });
    entity.x = state.u.ux;
    entity.y = state.u.uy;
}

async function finishCrushedMonster(
    monster: Monster, entity: DrawbridgeEntity, state: GameState,
    options: DrawbridgeOptions, death: DrawbridgeDeath, recordConduct: boolean,
): Promise<boolean> {
    if (!state.context.mon_moving) {
        const kill = options.finishMonsterKill ?? finishHeroMonsterKill;
        await kill(monster, entity.x, entity.y, {
            showKillMessage: recordConduct && death.showKillMessage,
            noCorpse: death.noCorpse,
            recordConduct,
        });
        return (monster.mhp ?? 0) <= 0;
    }
    const outcome = await finishMonsterKilled(monster, state, {
        damageType: death.noCorpse ? AD_DGST : AD_PHYS,
        // C e_died() always requests a line for the second monster-caused kill.
        cause: death.showKillMessage || !recordConduct ? '' : null,
    });
    return !outcome.survived;
}

async function crushEntity(
    entity: DrawbridgeEntity, bridge: DrawbridgeSquare, state: GameState,
    options: DrawbridgeOptions, killer: string, death: DrawbridgeDeath,
): Promise<void> {
    if (entity.hero) {
        const killerFormat = killer === 'crushed to death underneath a drawbridge'
            || killer === 'fell from a drawbridge' ? NO_KILLER_PREFIX : KILLED_BY_AN;
        const died = await finishHeroDeath({
            killer, killerFormat, deathType: CRUSHING, deathLineShown: true,
        });
        if (!died) await moveSurvivingHeroAway(entity, state);
        entity.x = state.u.ux;
        entity.y = state.u.uy;
        return;
    }
    const monster = entity.actor;
    if (await finishCrushedMonster(monster, entity, state, options, death, true))
        return;
    if (state.program_state.gameover) return;

    const visible = canSpotMonster(monster);
    const died = await finishCrushedMonster(
        monster, entity, state, options, death, false,
    );
    if (state.program_state.gameover) return;
    if (died && visible) {
        await plineWithContinuation(
            `Unfortunately for ${entityName(entity, state)}, ${monsterSubjectPronoun(monster, { state })} is still crushed.`,
        );
    }
}

type Occupants = [DrawbridgeEntity | null, DrawbridgeEntity | null];

function occupantAt(occupants: Occupants, x: number, y: number): DrawbridgeEntity | null {
    return occupants.find(entity => entity?.active && entity.x === x && entity.y === y) ?? null;
}

function entityPhrase(entity: DrawbridgeEntity, verb: string, state: GameState): string {
    return `${entityName(entity, state, true)} ${entity.hero ? verb : verbForSubject(null, verb)}`;
}

async function heroSpotEffects(state: GameState): Promise<void> {
    await finishDestinationSpotEffects({
        oldx: state.u.ux0, oldy: state.u.uy0, newx: state.u.ux, newy: state.u.uy, pick: false,
    });
}

async function dieMovingEntity(
    entity: DrawbridgeEntity, bridge: DrawbridgeSquare, state: GameState,
    options: DrawbridgeOptions, occupants: Occupants, killer: string, death: DrawbridgeDeath,
): Promise<void> {
    if (entity.hero && killer === 'fell from a drawbridge'
        && isPoolOrLavaAt(entity.x, entity.y, state)) {
        await heroLiquidEffects({
            state, entry: isPoolAt(entity.x, entity.y, state) ? 'drown' : 'lava',
            applyLandingEffects: ({ from, to, pick }) => finishDestinationSpotEffects({
                oldx: from.x, oldy: from.y, newx: to.x, newy: to.y, pick: pick ?? true,
            }),
        });
        entity.x = state.u.ux;
        entity.y = state.u.uy;
    } else {
        await crushEntity(entity, bridge, state, options, killer, death);
    }
    // C clears both records even if a vampire survives the second kill.
    // A long worm can occupy the span and portcullis at the same time.
    if (!entity.hero)
        for (const occupant of occupants)
            if (occupant?.actor === entity.actor) occupant.active = false;
}

async function handleEntity(
    entity: DrawbridgeEntity | null,
    bridge: DrawbridgeSquare,
    wall: DrawbridgeSquare,
    state: GameState,
    options: DrawbridgeOptions,
    occupants: Occupants,
): Promise<void> {
    if (!entity?.active) return;
    const inView = entityIsVisible(entity);
    const oldx = entity.x, oldy = entity.y;
    const location = occupiedLocation(entity, state);
    const atPortcullis = isDrawbridgeWallAt(oldx, oldy, state);
    const death = { showKillMessage: inView, noCorpse: true };
    if (entityAutomaticallyMissed(entity, state) && entitySurvivesAt(entity, state)) {
        if (inView && (atPortcullis || IS_DRAWBRIDGE(location.typ)))
            await plineWithContinuation(`The ${atPortcullis ? 'portcullis' : 'drawbridge'} passes through ${entityName(entity, state)}!`);
        if (entity.hero) await heroSpotEffects(state);
        return;
    }

    let mustJump = false, relocates = false;
    if (entityMissed(entity, state)) {
        if (atPortcullis)
            await plineWithContinuation(`The portcullis misses ${entityName(entity, state)}!`);
        if (entitySurvivesAt(entity, state)) return;
        if (atPortcullis) mustJump = true;
        else relocates = true;
    } else if (location.typ === DRAWBRIDGE_DOWN) {
        await plineWithContinuation(`${entityPhrase(entity, 'are', state)} crushed underneath the drawbridge.`);
        await dieMovingEntity(entity, bridge, state, options, occupants,
            'crushed to death underneath a drawbridge', death);
        return;
    } else {
        mustJump = true;
    }

    if (mustJump) {
        if (atPortcullis) {
            if (entityJumps(entity, state)) {
                relocates = true;
            } else {
                if (inView)
                    await plineWithContinuation(`${entityPhrase(entity, 'are', state)} crushed by the falling portcullis!`);
                else if (!heroIsDeaf(state))
                    await publishHeardMessage('a crushing sound.', plineWithContinuation, state);
                await dieMovingEntity(entity, bridge, state, options, occupants,
                    'falling drawbridge', death);
                return;
            }
        } else {
            relocates = !entityJumps(entity, state);
        }
    }

    const destination = entity.x === bridge.x && entity.y === bridge.y ? wall : bridge;
    const other = occupantAt(occupants, destination.x, destination.y);
    if (relocates && other) {
        if (entitySurvivesAt(other, state) && entityAutomaticallyMissed(other, state)) {
            relocates = false;
        } else {
            while (occupantAt(occupants, destination.x, destination.y)
                && occupantAt(occupants, destination.x, destination.y) !== entity) {
                await handleEntity(other, bridge, wall, state, options, occupants);
                if (state.program_state.gameover) return;
            }
            if (occupantAt(occupants, oldx, oldy) !== entity) return;
        }
    }
    if (relocates && !occupantAt(occupants, destination.x, destination.y))
        moveEntity(entity, destination, state);

    const visibleAfterMove = entityIsVisible(entity);
    if (isDrawbridgeWallAt(entity.x, entity.y, state)) {
        if (visibleAfterMove) {
            if (entity.hero) {
                await plineWithContinuation('You tumble towards the closed portcullis!');
                await plineWithContinuation(entityAutomaticallyMissed(entity, state)
                    ? 'You pass through it!' : 'The drawbridge closes in...');
            } else {
                await plineWithContinuation(`${entityPhrase(entity, 'disappear', state)} behind the drawbridge.`);
            }
        }
        if (!entitySurvivesAt(entity, state))
            await dieMovingEntity(entity, bridge, state, options, occupants,
                'closing drawbridge', { showKillMessage: false, noCorpse: false });
        return;
    }
    if (isPoolAt(entity.x, entity.y, state) && !visibleAfterMove && !heroIsDeaf(state))
        await publishHeardMessage('a splash.', plineWithContinuation, state);
    if (entitySurvivesAt(entity, state)) {
        if (visibleAfterMove && !entityIsFlying(entity) && !entityIsFloating(entity))
            await plineWithContinuation(`${entityPhrase(entity, 'fall', state)} from the bridge.`);
        return;
    }
    if (isPoolOrLavaAt(entity.x, entity.y, state) && visibleAfterMove && !entity.hero) {
        const lava = isLavaAt(entity.x, entity.y, state);
        if (heroIsHallucinating(state))
            await plineWithContinuation(`${entityPhrase(entity, 'drink', state)} the ${lava ? 'lava' : 'moat'} and disappears.`);
        else
            await plineWithContinuation(`${entityPhrase(entity, 'fall', state)} into the ${lava ? displayLiquidName('lava', state) : 'moat'}.`);
    }
    await dieMovingEntity(entity, bridge, state, options, occupants,
        'fell from a drawbridge', { showKillMessage: visibleAfterMove, noCorpse: true });
}

export async function moveDrawbridgeOccupants(
    bridge: DrawbridgeSquare,
    wall: DrawbridgeSquare,
    state: GameState,
    options: DrawbridgeOptions = {},
): Promise<void> {
    const occupants: Occupants = [entityAt(bridge.x, bridge.y, state), entityAt(wall.x, wall.y, state)];
    await handleEntity(occupants[0], bridge, wall, state, options, occupants);
    if (state.program_state.gameover) return;
    occupants[1] = entityAt(wall.x, wall.y, state);
    await handleEntity(occupants[1], bridge, wall, state, options, occupants);
}

async function settleEntityAfterCollapse(entity: DrawbridgeEntity, state: GameState): Promise<void> {
    if (entity.hero) {
        await heroSpotEffects(state);
        return;
    }
    await resolveMonsterLiquid(entity.actor, state, {
        announce: plineWithContinuation,
        finishDeath: finishLiquidDeathForCurrentMover,
        monsterMoving: !!state.context.mon_moving,
    });
}

async function killCollapseVictim(
    entity: DrawbridgeEntity, bridge: DrawbridgeSquare, state: GameState,
    options: DrawbridgeOptions, occupants: Occupants,
    killer: 'exploding drawbridge' | 'collapsing drawbridge',
): Promise<void> {
    const inView = entityIsVisible(entity);
    if (inView) {
        if (killer === 'exploding drawbridge')
            await plineWithContinuation(`${entityPhrase(entity, 'are', state)} blown apart by flying debris.`);
        else if (!entity.hero && heroIsHallucinating(state))
            await plineWithContinuation(`${entityPhrase(entity, 'get', state)} into some heavy metal!`);
        else
            await plineWithContinuation(`${entityPhrase(entity, 'are', state)} hit by a huge chunk of metal!`);
    } else if (killer === 'collapsing drawbridge'
        && !heroIsDeaf(state) && !entity.hero && !isPoolAt(bridge.x, bridge.y, state)) {
        await publishHeardMessage('a crushing sound.', plineWithContinuation, state);
    }
    await dieMovingEntity(entity, bridge, state, options, occupants, killer, {
        showKillMessage: inView, noCorpse: true,
    });
}

export async function destroyDrawbridgeOccupants(
    bridge: DrawbridgeSquare,
    wall: DrawbridgeSquare,
    state: GameState,
    options: DrawbridgeOptions = {},
): Promise<void> {
    const occupants: Occupants = [null, entityAt(wall.x, wall.y, state)];
    const atWall = occupants[1];
    if (atWall && !entityAutomaticallyMissed(atWall, state)) {
        await killCollapseVictim(
            atWall, bridge, state, options, occupants, 'exploding drawbridge',
        );
        if (state.program_state?.gameover) return;
    }

    const onSpan = occupants[0] = entityAt(bridge.x, bridge.y, state);
    if (!onSpan) return;
    if (entityMissed(onSpan, state, true)) {
        await settleEntityAfterCollapse(onSpan, state);
        return;
    }
    await killCollapseVictim(
        onSpan, bridge, state, options, occupants, 'collapsing drawbridge',
    );
    if (state.program_state.gameover) return;
    if (state.level?.at(onSpan.x, onSpan.y)?.typ === MOAT)
        await handleEntity(onSpan, bridge, wall, state, options, occupants);
}
