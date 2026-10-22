// C hack.c:spoteffects() and teleport.c:teleds().

import { bot, plineWithContinuation } from './display.js';
import { game, requirePlayingGame } from './gstate.js';
import type { HeroTeleportMovement } from './teleport.js';
import type { MessagePublisher } from './display.js';
import type { HeroTrapOptions } from './hero_traps.js';
import type { Trap, Position } from './map_types.js';
import { MAX_TYPE, IS_SINK, I_SPECIAL, TIMEOUT, VAULT, is_pit } from './const.js';
import { applyHeroLiquidEffects } from './cmd.js';
import { floatHeroDown, switchHeroTerrain } from './terrain_movement.js';
import { levitationIsPurelyTimed, propertyIsActive } from './properties.js';
import { rn2 } from './rng.js';
import { fallIntoSink } from './sink_fall.js';
import { triggerHeroTrapAt } from './hero_traps.js';
import { gotoLevel } from './level_change.js';
import { autopickupAtHero } from './pickup.js';
import { checkSpecialRoom } from './shk.js';
import { announceInvocationSquare } from './invocation.js';
import { levelTimers, LEVEL_TIMER_KIND } from './object_timers.js';
import { isIceAt } from './terrain_properties.js';
import { finishCeilingMonsterArrival } from './ceiling_monster_arrival.js';
import { roomsAt } from './room.js';
import { findVaultGuard } from './vault_guard.js';
import { noticeVaultEscape } from './vault_escort.js';

export interface SpotEffectResult {
    died: boolean;
    moved?: boolean;
    dismounted?: boolean;
    shortCircuited?: boolean;
    entered?: boolean;
    left?: boolean;
    sank?: boolean;
    from?: Position;
    to?: Position;
}
export interface SpotEffectOptions {
    oldx: number;
    oldy: number;
    newx: number;
    newy: number;
    trapOptions?: HeroTrapOptions;
    publish?: MessagePublisher;
    pick?: boolean;
}
interface ActiveSpot extends Position {
    typ: number;
    trap: Trap | undefined;
    trapType: number | undefined;
}

export async function finishTeleportArrival(
    movement: HeroTeleportMovement, { announceTeleport = true } = {},
): Promise<SpotEffectResult> {
    requirePlayingGame(game);
    await bot();
    if (announceTeleport && game.flags.verbose !== false) {
        const place = movement.oldx === movement.x && movement.oldy === movement.y
            ? 'the same' : 'a different';
        await plineWithContinuation(`You materialize in ${place} location!`);
    }
    if (game.level.requireAt(game.u.ux, game.u.uy).typ
        !== game.level.requireAt(movement.oldx, movement.oldy).typ)
        await switchHeroTerrain(game);
    if (roomsAt(game.level, movement.oldx, movement.oldy, VAULT).length
        && !roomsAt(game.level, game.u.ux, game.u.uy, VAULT).length) {
        const guard = findVaultGuard(game);
        if (guard) await noticeVaultEscape(guard, game);
    }
    const result = await finishDestinationSpotEffects({
        ...movement, newx: movement.x, newy: movement.y,
    });
    if (result.died || game.program_state.gameover) return { ...result, died: true };
    await announceInvocationSquare();
    return result;
}

// C spoteffects() suppresses same-location recursion, but permits a changed
// square, terrain, or trap to start another transaction.
let spotDepth = 0;
let activeSpot: ActiveSpot | null = null;
// C spoteffects() static spottraptyp: while a trap is being triggered, a
// nested spoteffects() skips any trap of the same type, such as a fire
// trap reached by crawling out of the water its own flames melted.
let triggeringTrapType: number | null = null;

export async function finishDestinationSpotEffects({
    oldx, oldy, newx, newy, trapOptions = {},
    publish = plineWithContinuation, pick = true,
}: SpotEffectOptions): Promise<SpotEffectResult> {
    // C spoteffects() defers lava-rescue landing until lava_effects ends.
    if (game.iflags?.in_lava_effects) return { moved: false, died: false };
    requirePlayingGame(game);
    const location = game.level.at(newx, newy);
    if (!location) throw new RangeError(`No landing square at ${newx},${newy}.`);
    const typ = location.typ;
    let trap: Trap | null | undefined = game.level.traps.find(candidate =>
        candidate.tx === newx && candidate.ty === newy);
    if (spotDepth && activeSpot && activeSpot.x === newx && activeSpot.y === newy
        && activeSpot.typ === typ
        && (!activeSpot.trap || !trap || activeSpot.trapType === trap.ttyp))
        return { moved: false, died: false };
    spotDepth++;
    activeSpot = { x: newx, y: newy, typ, trap, trapType: trap?.ttyp };
    try {
        game.iflags ||= {};
        if (game.iflags.terrain_typ == null) game.iflags.terrain_typ = MAX_TYPE;
        // Only classify_terrain() for the terrainstatus option updates
        // terrain_typ; otherwise it stays MAX_TYPE and every call switches.
        if (typ !== game.level.at(oldx, oldy)?.typ
            || game.iflags.terrain_typ === MAX_TYPE) {
            await switchHeroTerrain(game);
        }
        const liquid = await applyHeroLiquidEffects(publish);
        if (liquid?.entered && (liquid.moved || liquid.died || liquid.dismounted)) return liquid;
        await checkSpecialRoom();
        if (IS_SINK(game.level.at(game.u.ux, game.u.uy)?.typ ?? -1)
            && propertyIsActive('levitation', game)) {
            await fallIntoSink(game);
            if (game.program_state.gameover) return { died: true };
        }
        if (!game._steedDismounting) {
            if (trap && game.u.levitationTurns === 1
                && levitationIsPurelyTimed(game)) {
                if (rn2(2)) {
                    game.u.levitationTurns++;
                } else if (await floatHeroDown(I_SPECIAL | TIMEOUT, 0, game)) {
                    trap = null;
                    pick = false;
                }
                if (game.program_state.gameover) return { died: true };
            }
            const pit = trap && is_pit(trap.ttyp);
            if (pick && !pit) await autopickupAtHero();
            if (game.program_state.gameover) return { died: true };
            if (trap && triggeringTrapType !== trap.ttyp) {
                triggeringTrapType = trap.ttyp;
                let result;
                try {
                    result = await triggerHeroTrapAt(newx, newy, {
                        finishTeleport: finishTeleportArrival, gotoLevel, ...trapOptions,
                    });
                } finally {
                    triggeringTrapType = null;
                }
                if (result?.died) return { died: true };
                if (result?.shortCircuited)
                    return { shortCircuited: true, moved: false, died: false };
            }
            if (pick && pit) await autopickupAtHero();
            if (game.program_state.gameover) return { died: true };
        }
        await warnAboutMeltingIce(publish);
        if (await finishCeilingMonsterArrival(game, publish)) return { died: true };
        return { moved: false, died: !!game.program_state.gameover };
    } finally {
        if (--spotDepth === 0) activeSpot = null;
    }
}

async function warnAboutMeltingIce(publish: MessagePublisher): Promise<void> {
    const { ux: x, uy: y } = game.u;
    if (!propertyIsActive('warning', game) || !isIceAt(x, y, game)) return;
    const timer = levelTimers(game).find(candidate =>
        candidate.kind === LEVEL_TIMER_KIND.MELT_ICE_AWAY && candidate.x === x && candidate.y === y);
    const remaining = timer ? timer.deadline - game.moves : 0;
    if (!remaining || remaining >= 15) return;
    await publish(remaining < 5 ? 'The ice, is gonna BREAK!'
        : remaining < 10 ? 'You feel the ice shift beneath you!'
            : 'The ice seems very soft and slushy.');
}
