// C hack.c:spoteffects() and teleport.c:teleds().
import { bot, plineWithContinuation } from './display.js';
import { maybeSmudgeEngravings } from './engrave.js';
import { game, requirePlayingGame } from './gstate.js';
import { MAX_TYPE, IS_SINK, I_SPECIAL, TIMEOUT, is_pit } from './const.js';
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
export async function finishTeleportArrival(movement, { announceTeleport = true } = {}) {
    await bot();
    if (announceTeleport && game.flags.verbose !== false) {
        const place = movement.oldx === movement.x && movement.oldy === movement.y
            ? 'the same' : 'a different';
        await plineWithContinuation(`You materialize in ${place} location!`);
    }
    const result = await finishDestinationSpotEffects({
        ...movement, newx: movement.x, newy: movement.y, explicitAttempt: false,
    });
    if (result.died || game.program_state.gameover)
        return { ...result, died: true };
    await announceInvocationSquare();
    return result;
}
// C spoteffects() suppresses same-location recursion, but permits a changed
// square, terrain, or trap to start another transaction.
let spotDepth = 0;
let activeSpot = null;
export async function finishDestinationSpotEffects({ oldx, oldy, newx, newy, explicitAttempt, trapOptions = {}, publish = plineWithContinuation, pick = true, }) {
    // C spoteffects() defers lava-rescue landing until lava_effects ends.
    if (game.iflags?.in_lava_effects)
        return { moved: false, died: false };
    requirePlayingGame(game);
    const location = game.level.at(newx, newy);
    if (!location)
        throw new RangeError(`No landing square at ${newx},${newy}.`);
    const typ = location.typ;
    let trap = game.level.traps.find(candidate => candidate.tx === newx && candidate.ty === newy);
    if (spotDepth && activeSpot && activeSpot.x === newx && activeSpot.y === newy
        && activeSpot.typ === typ
        && (!activeSpot.trap || !trap || activeSpot.trapType === trap.ttyp))
        return { moved: false, died: false };
    spotDepth++;
    activeSpot = { x: newx, y: newy, typ, trap, trapType: trap?.ttyp };
    try {
        game.iflags ||= {};
        if (game.iflags.terrain_typ == null)
            game.iflags.terrain_typ = MAX_TYPE;
        if (typ !== game.level.at(oldx, oldy)?.typ
            || game.iflags.terrain_typ === MAX_TYPE) {
            if (!game.flags.terrainstatus)
                game.iflags.terrain_typ = typ;
            await switchHeroTerrain(game);
        }
        const liquid = await applyHeroLiquidEffects(publish);
        if (liquid?.entered && (liquid.moved || liquid.died || liquid.dismounted))
            return liquid;
        await checkSpecialRoom();
        if (IS_SINK(game.level.at(game.u.ux, game.u.uy)?.typ ?? -1)
            && propertyIsActive('levitation', game)) {
            await fallIntoSink(game);
            if (game.program_state.gameover)
                return { died: true };
        }
        if (!game._steedDismounting) {
            if (trap && game.u.levitationTurns === 1
                && levitationIsPurelyTimed(game)) {
                if (rn2(2)) {
                    game.u.levitationTurns++;
                }
                else if (await floatHeroDown(I_SPECIAL | TIMEOUT, 0, game)) {
                    trap = null;
                    pick = false;
                }
                if (game.program_state.gameover)
                    return { died: true };
            }
            const pit = trap && is_pit(trap.ttyp);
            if (pick && !pit)
                await autopickupAtHero();
            if (game.program_state.gameover)
                return { died: true };
            if (trap) {
                const result = await triggerHeroTrapAt(newx, newy, {
                    finishTeleport: finishTeleportArrival, gotoLevel, ...trapOptions,
                });
                if (result?.died)
                    return { died: true };
                if (result?.shortCircuited)
                    return { shortCircuited: true, moved: false, died: false };
            }
            if (pick && pit)
                await autopickupAtHero();
            if (game.program_state.gameover)
                return { died: true };
        }
        if (explicitAttempt)
            maybeSmudgeEngravings(oldx, oldy, newx, newy);
        return { moved: false, died: !!game.program_state.gameover };
    }
    finally {
        if (--spotDepth === 0)
            activeSpot = null;
    }
}
//# sourceMappingURL=location_effects.js.map