// Occupants caught by a moving drawbridge.
// C ref: dbridge.c do_entity(), e_missed(), e_jumps(), e_survives_at().
import { monsterHasMapPosition } from './monster_location.js';
import { heroIsUnaware } from './hero_sleep.js';
import { isDrawbridgeWallAt, isLavaAt, isPoolAt, isPoolOrLavaAt } from './terrain_properties.js';
import { DB_FLOOR, DB_ICE, DB_LAVA, DB_MOAT, DB_UNDER, DRAWBRIDGE_DOWN, ICE, LAVAPOOL, MOAT, ROOM, } from './const.js';
import { canSeeMonster, canSpotMonster, newsym, plineWithContinuation, } from './display.js';
import { finishHeroDeath } from './end.js';
import { finishHeroMonsterKill } from './hero_monster_death.js';
import { heroLiquidEffects } from './hack.js';
import { resolveMonsterLiquid } from './mon.js';
import { MONSTER_FLAGS1, MONSTER_MOVE, MONSTER_NAME, MONSTER_SYMBOL, } from './monster_data.js';
import { finishMonsterKilled, finishMonsterLiquidDeath, } from './monster_death.js';
import { AD_DGST, AD_PHYS } from './monster_attack_types.js';
import { heroIsPolymorphed } from './polyself.js';
import { rnd } from './rng.js';
import { updateMonsterRegions } from './regions.js';
import { moveHeroByTeleport, safeTeleportDestination, } from './teleport.js';
import { vision_recalc } from './vision.js';
const M1_FLY = 0x00000001;
const M1_SWIM = 0x00000002;
const M1_WALLWALK = 0x00000008;
const M1_AMPHIBIOUS = 0x00000200;
const M1_BREATHLESS = 0x00000400;
const S_EYE = 5;
const S_LIGHT = 25;
const S_GHOST = 54;
const PM_FIRE_ELEMENTAL = 155;
const PM_SALAMANDER = 329;
function monsterAt(x, y, state) {
    return state.level?.monsters?.find(monster => monsterHasMapPosition(monster, state) &&
        (monster.mhp ?? 1) > 0 && monster.mx === x && monster.my === y) || null;
}
function entityAt(x, y, state) {
    if (state.u?.ux === x && state.u?.uy === y)
        return { hero: true, actor: state.u, x, y };
    const monster = monsterAt(x, y, state);
    return monster ? { hero: false, actor: monster, x, y } : null;
}
function heroFormFlags(state) {
    const mnum = state.u.umonnum;
    if (!heroIsPolymorphed(state) || mnum === undefined)
        return 0;
    return MONSTER_FLAGS1[mnum] ?? 0;
}
function entityFlags(entity, state) {
    return entity.hero ? heroFormFlags(state) : MONSTER_FLAGS1[entity.actor.mnum] ?? 0;
}
function entitySymbol(entity, state) {
    if (entity.hero) {
        const mnum = state.u.umonnum;
        if (!heroIsPolymorphed(state) || mnum === undefined)
            return null;
        return MONSTER_SYMBOL[mnum] ?? null;
    }
    return MONSTER_SYMBOL[entity.actor.mnum] ?? null;
}
function entityName(entity) {
    if (entity.hero)
        return 'you';
    return entity.actor.name
        || `the ${MONSTER_NAME[entity.actor.mnum] || 'monster'}`;
}
function entityIsVisible(entity) {
    return entity.hero || canSeeMonster(entity.actor);
}
function entityPassesWalls(entity, state) {
    if (entity.hero
        && state.u.passesWalls)
        return true;
    return !!(entityFlags(entity, state) & M1_WALLWALK);
}
function entityIsNoncorporeal(entity, state) {
    return entitySymbol(entity, state) === S_GHOST;
}
function entityIsFlying(entity, state) {
    if (entity.hero && state.u.flying)
        return true;
    return !!(entityFlags(entity, state) & M1_FLY);
}
function entityIsFloating(entity, state) {
    if (entity.hero
        && (state.u?.levitating || state.u?.levitation))
        return true;
    const symbol = entitySymbol(entity, state);
    return symbol === S_EYE || symbol === S_LIGHT;
}
function entityIsHelpless(entity) {
    if (entity.hero)
        return false;
    const monster = entity.actor;
    return !monster.mcanmove || !!monster.msleeping
        || (monster.mfrozen ?? 0) > 0;
}
function entityIsConfused(entity, state) {
    return entity.hero
        ? !!(state.u?.confused || (state.u?.confusionTurns ?? 0) > 0)
        : !!entity.actor.mconf;
}
function entityIsStunned(entity, state) {
    return entity.hero
        ? !!(state.u?.stunned || (state.u?.stunnedTurns ?? 0) > 0)
        : !!entity.actor.mstun;
}
function bridgeUnderlyingTerrain(bridge) {
    const under = (bridge.location.drawbridgemask || 0) & DB_UNDER;
    if (under === DB_LAVA)
        return LAVAPOOL;
    if (under === DB_MOAT)
        return MOAT;
    if (under === DB_ICE)
        return ICE;
    if (under === DB_FLOOR)
        return ROOM;
    return ROOM;
}
function occupiedLocation(entity, state) {
    const location = state.level?.at(entity.x, entity.y);
    if (!location)
        throw new Error(`Drawbridge occupant has no map cell at (${entity.x}, ${entity.y}).`);
    return location;
}
function heroSurvivesPool(state) {
    const hero = state.u || {};
    const flags = heroFormFlags(state);
    return !!(hero.waterWalking
        || hero.amphibious || hero.swimming || hero.breathless
        || hero.flying || hero.levitating || hero.levitation
        || (flags & (M1_SWIM | M1_AMPHIBIOUS | M1_BREATHLESS | M1_FLY)));
}
function monsterSurvivesPool(entity, state) {
    const flags = entityFlags(entity, state);
    return !!(flags & (M1_SWIM | M1_AMPHIBIOUS | M1_BREATHLESS | M1_FLY))
        || entityIsFloating(entity, state);
}
function entitySurvivesAt(entity, state) {
    if (entityIsNoncorporeal(entity, state))
        return true;
    if (isPoolAt(entity.x, entity.y, state)) {
        return entity.hero
            ? heroSurvivesPool(state) : monsterSurvivesPool(entity, state);
    }
    if (isLavaAt(entity.x, entity.y, state)) {
        if (entity.hero)
            return !!(state.u?.levitating || state.u?.levitation
                || state.u?.flying);
        return entityIsFlying(entity, state)
            || entity.actor.mnum === PM_FIRE_ELEMENTAL
            || entity.actor.mnum === PM_SALAMANDER;
    }
    if (isDrawbridgeWallAt(entity.x, entity.y, state))
        return entityPassesWalls(entity, state);
    return true;
}
function entityAutomaticallyMissed(entity, state) {
    return entityPassesWalls(entity, state)
        || entityIsNoncorporeal(entity, state);
}
function entityMissed(entity, state, chunks = false) {
    if (entityAutomaticallyMissed(entity, state))
        return true;
    let misses = 0;
    const flyingCanReact = entity.hero
        ? !heroIsUnaware(state) : !entityIsHelpless(entity);
    if (entityIsFlying(entity, state) && flyingCanReact)
        misses = 5;
    else if (entityIsFloating(entity, state))
        misses = 3;
    else if (chunks && isPoolAt(entity.x, entity.y, state))
        misses = 2;
    if (isDrawbridgeWallAt(entity.x, entity.y, state))
        misses -= 3;
    return misses >= rnd(8);
}
function entityJumps(entity, state) {
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
    if (entityIsConfused(entity, state))
        chances -= 2;
    if (entityIsStunned(entity, state))
        chances -= 3;
    if (isDrawbridgeWallAt(entity.x, entity.y, state))
        chances -= 2;
    return chances >= rnd(10);
}
function moveEntity(entity, destination, state) {
    const old = { x: entity.x, y: entity.y };
    if (entity.hero) {
        state.u.ux0 = old.x;
        state.u.uy0 = old.y;
        state.u.ux = destination.x;
        state.u.uy = destination.y;
        vision_recalc(1);
    }
    else {
        entity.actor.mx = destination.x;
        entity.actor.my = destination.y;
        updateMonsterRegions(entity.actor, state);
    }
    entity.x = destination.x;
    entity.y = destination.y;
    newsym(old.x, old.y);
    newsym(destination.x, destination.y);
}
async function moveSurvivingHeroAway(entity, state) {
    if (entitySurvivesAt(entity, state))
        return;
    const destination = safeTeleportDestination(state);
    if (!destination)
        return;
    await plineWithContinuation('A strange force teleports you away...');
    await moveHeroByTeleport(destination.x, destination.y, state);
    entity.x = state.u.ux;
    entity.y = state.u.uy;
}
async function finishCrushedMonster(monster, entity, state, options, death, recordConduct) {
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
async function crushEntity(entity, bridge, state, options, killer, death) {
    if (entity.hero) {
        state.u.uhp = 0;
        const died = await finishHeroDeath({ killer });
        if (!died)
            await moveSurvivingHeroAway(entity, state);
        return;
    }
    const monster = entity.actor;
    if (await finishCrushedMonster(monster, entity, state, options, death, true))
        return;
    if (state.program_state.gameover)
        return;
    const visible = canSpotMonster(monster);
    const died = await finishCrushedMonster(monster, entity, state, options, death, false);
    if (state.program_state.gameover)
        return;
    if (died && visible) {
        await plineWithContinuation(`Unfortunately for ${entityName(entity)}, it is still crushed.`);
    }
}
async function settleEntityOnBridge(entity, bridge, state, options) {
    const under = bridgeUnderlyingTerrain(bridge);
    if (!isPoolOrLavaAt(entity.x, entity.y, state))
        return;
    const location = bridge.location;
    const drawbridgeType = location.typ;
    location.typ = under;
    try {
        if (entity.hero) {
            await heroLiquidEffects({
                state,
            });
        }
        else {
            await crushEntity(entity, bridge, state, options, 'fell from a drawbridge', {
                showKillMessage: entityIsVisible(entity), noCorpse: true,
            });
        }
    }
    finally {
        location.typ = drawbridgeType;
    }
}
function sameEntity(left, right) {
    return !!left && !!right && left.hero === right.hero
        && left.actor === right.actor;
}
async function handleEntity(entity, bridge, wall, state, options, handled) {
    if (!entity || handled.has(entity.actor))
        return;
    handled.add(entity.actor);
    const location = occupiedLocation(entity, state);
    let atPortcullis = isDrawbridgeWallAt(entity.x, entity.y, state);
    if (entityAutomaticallyMissed(entity, state)
        && entitySurvivesAt(entity, state)) {
        if (entityIsVisible(entity)) {
            await plineWithContinuation(`The ${atPortcullis ? 'portcullis' : 'drawbridge'} passes through ${entityName(entity)}!`);
        }
        return;
    }
    let mustJump = false;
    let relocates = false;
    if (entityMissed(entity, state)) {
        if (atPortcullis && entityIsVisible(entity)) {
            await plineWithContinuation(`The portcullis misses ${entityName(entity)}!`);
        }
        if (entitySurvivesAt(entity, state))
            return;
        if (atPortcullis)
            mustJump = true;
        else
            relocates = true;
    }
    else if (location.typ === DRAWBRIDGE_DOWN) {
        await plineWithContinuation(entity.hero
            ? 'You are crushed underneath the drawbridge.'
            : `${entityName(entity)} is crushed underneath the drawbridge.`);
        await crushEntity(entity, bridge, state, options, 'crushed to death underneath a drawbridge', { showKillMessage: entityIsVisible(entity), noCorpse: true });
        return;
    }
    else {
        mustJump = true;
    }
    if (mustJump) {
        if (atPortcullis) {
            if (entityJumps(entity, state)) {
                relocates = true;
            }
            else {
                if (entityIsVisible(entity)) {
                    await plineWithContinuation(entity.hero
                        ? 'You are crushed by the falling portcullis!'
                        : `${entityName(entity)} is crushed by the falling portcullis!`);
                }
                await crushEntity(entity, bridge, state, options, 'crushed by a falling portcullis', { showKillMessage: entityIsVisible(entity), noCorpse: true });
                return;
            }
        }
        else {
            relocates = !entityJumps(entity, state);
        }
    }
    const onWallSquare = entity.x === wall.x && entity.y === wall.y;
    const destination = onWallSquare
        ? { x: bridge.x, y: bridge.y }
        : { x: wall.x, y: wall.y };
    if (relocates) {
        const other = entityAt(destination.x, destination.y, state);
        if (other && !sameEntity(entity, other)) {
            await handleEntity(other, bridge, wall, state, options, handled);
            if (state.program_state?.gameover)
                return;
        }
        const remaining = entityAt(destination.x, destination.y, state);
        if (!remaining || sameEntity(entity, remaining))
            moveEntity(entity, destination, state);
    }
    atPortcullis = isDrawbridgeWallAt(entity.x, entity.y, state);
    if (atPortcullis) {
        if (entitySurvivesAt(entity, state))
            return;
        await crushEntity(entity, bridge, state, options, 'closing drawbridge', {
            showKillMessage: false, noCorpse: false,
        });
        return;
    }
    if (entitySurvivesAt(entity, state)) {
        if (entityIsVisible(entity)
            && !entityIsFlying(entity, state)
            && !entityIsFloating(entity, state)) {
            await plineWithContinuation(entity.hero
                ? 'You fall from the bridge.'
                : `${entityName(entity)} falls from the bridge.`);
        }
        return;
    }
    await settleEntityOnBridge(entity, bridge, state, options);
}
export async function moveDrawbridgeOccupants(bridge, wall, state, options = {}) {
    const handled = new Set();
    await handleEntity(entityAt(bridge.x, bridge.y, state), bridge, wall, state, options, handled);
    if (state.program_state?.gameover)
        return;
    await handleEntity(entityAt(wall.x, wall.y, state), bridge, wall, state, options, handled);
}
async function settleEntityAfterCollapse(entity, state) {
    if (!isPoolOrLavaAt(entity.x, entity.y, state))
        return;
    if (entity.hero) {
        await heroLiquidEffects({
            state,
        });
        return;
    }
    await resolveMonsterLiquid(entity.actor, state, {
        announce: plineWithContinuation,
        finishDeath: finishMonsterLiquidDeath,
        monsterMoving: false,
    });
}
async function killCollapseVictim(entity, bridge, state, options, killer) {
    if (entityIsVisible(entity)) {
        await plineWithContinuation(entity.hero
            ? `You are ${killer === 'exploding drawbridge'
                ? 'blown apart by flying debris'
                : 'hit by a huge chunk of metal'}!`
            : `${entityName(entity)} is ${killer === 'exploding drawbridge'
                ? 'blown apart by flying debris'
                : 'hit by a huge chunk of metal'}!`);
    }
    await crushEntity(entity, bridge, state, options, killer, {
        showKillMessage: entityIsVisible(entity), noCorpse: true,
    });
}
export async function destroyDrawbridgeOccupants(bridge, wall, state, options = {}) {
    const atWall = entityAt(wall.x, wall.y, state);
    if (atWall && !entityAutomaticallyMissed(atWall, state)) {
        await killCollapseVictim(atWall, bridge, state, options, 'exploding drawbridge');
        if (state.program_state?.gameover)
            return;
    }
    const onSpan = entityAt(bridge.x, bridge.y, state);
    if (!onSpan)
        return;
    if (entityMissed(onSpan, state, true)) {
        await settleEntityAfterCollapse(onSpan, state);
        return;
    }
    await killCollapseVictim(onSpan, bridge, state, options, 'collapsing drawbridge');
}
//# sourceMappingURL=drawbridge_occupants.js.map