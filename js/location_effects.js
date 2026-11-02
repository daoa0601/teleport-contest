// C teleport.c:teleds() landing tail. hack.c:spoteffects() lives in hack.ts.
import { bot } from './botl.js';
import { plineWithContinuation } from './pline.js';
import { game, requirePlayingGame } from './gstate.js';
import { MAX_TYPE, VAULT } from './const.js';
import { switchHeroTerrain, roomsAt, finishDestinationSpotEffects } from './hack.js';
import { findVaultGuard, noticeVaultEscape } from './vault.js';
// Landing effects for ordinary teleportation. moveHeroByTeleport() owns
// the surrounding notice block and the invocation message that follows.
export async function finishTeleportArrival(movement, { announceTeleport = true } = {}) {
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
        const guard = await findVaultGuard(game);
        if (guard)
            await noticeVaultEscape(guard, game);
    }
    const result = await finishDestinationSpotEffects({
        ...movement, newx: movement.x, newy: movement.y,
    });
    if (result.died || game.program_state.gameover)
        return { ...result, died: true };
    return result;
}
//# sourceMappingURL=location_effects.js.map