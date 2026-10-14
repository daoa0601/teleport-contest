// C zap.c:melt_ice(). Await the complete terrain, object, and occupant effect.
import { BEAR_TRAP, DB_ICE, DRAWBRIDGE_DOWN, DRAWBRIDGE_UP, ICE, ICED_POOL, MAGIC_PORTAL, MOAT, POOL, LANDMINE, VIBRATING_SQUARE, } from './const.js';
import { unearthFloorObjectsAt } from './buried_object.js';
import { dropBoulderIntoLiquid } from './boulder_pool.js';
import { applyHeroLocationEffects } from './cmd.js';
import { impossible } from './diagnostics.js';
import { newsym, plineWithContinuation } from './display.js';
import { remove_object, updateIceObjectTimersAt } from './floor_object.js';
import { game, requireGameLevel } from './gstate.js';
import { resolveMonsterLiquid } from './mon.js';
import { finishMonsterLiquidDeath } from './monster_death.js';
import { finishHeroLiquidMonsterDeath } from './hero_monster_death.js';
import { monsterAtPosition } from './monster_location.js';
import { BEARTRAP, BOULDER, LAND_MINE } from './object_data.js';
import { withIndefiniteArticle } from './object_grammar.js';
import { LEVEL_TIMER_KIND, stopLevelTimer } from './object_timers.js';
import { objectName } from './objnam.js';
import { isPoolAt } from './terrain_properties.js';
import { deleteTrap } from './trap_lifecycle.js';
import { convertTrapToObject } from './trap_object.js';
import { cansee, vision_recalc } from './vision.js';
export async function meltIce(x, y, { announce = plineWithContinuation, message = 'The ice crackles and melts.', } = {}) {
    const level = requireGameLevel(game);
    const location = level.at(x, y);
    if (!location)
        throw new RangeError(`Cannot melt ice outside the map: ${x},${y}`);
    if (location.typ === DRAWBRIDGE_UP || location.typ === DRAWBRIDGE_DOWN) {
        // A lowered bridge hides its ice, but its existing timer still expires.
        location.drawbridgemask = (location.drawbridgemask ?? 0) & ~DB_ICE;
    }
    else {
        if (location.typ !== ICE)
            throw new Error(`cannot melt non-ice position ${x},${y}`);
        location.typ = location.icedpool === ICED_POOL ? POOL : MOAT;
        location.flags = 0;
        location.icedpool = 0;
    }
    stopLevelTimer(x, y, LEVEL_TIMER_KIND.MELT_ICE_AWAY, game);
    await meltIceTrap(x, y);
    if (game.program_state.gameover)
        return;
    updateIceObjectTimersAt(x, y, game);
    await unearthFloorObjectsAt(x, y, game);
    if (game.program_state.gameover)
        return;
    if (game.underwater)
        vision_recalc(1);
    newsym(x, y);
    if (cansee(x, y) || game.u.ux === x && game.u.uy === y)
        await announce(message || 'The ice crackles and melts.', { noRepeat: true });
    let boulder = floorBoulderAt(x, y);
    if (boulder) {
        if (cansee(x, y)) {
            const subject = withIndefiniteArticle(objectName(boulder));
            await announce(`${subject.charAt(0).toUpperCase()}${subject.slice(1)} settles...`);
        }
        do {
            remove_object(boulder, game);
            if (!await dropBoulderIntoLiquid(boulder, x, y, game, { publish: announce }))
                await impossible('melt_ice: no pool?');
            if (game.program_state.gameover)
                return;
        } while (isPoolAt(x, y) && (boulder = floorBoulderAt(x, y)));
        newsym(x, y);
    }
    if (game.u.ux === x && game.u.uy === y) {
        await applyHeroLocationEffects(announce, { pick: true });
    }
    else if (isPoolAt(x, y)) {
        const monster = monsterAtPosition(requireGameLevel(game), x, y);
        if (monster) {
            await resolveMonsterLiquid(monster, game, {
                announce, finishDeath: game.context.mon_moving
                    ? finishMonsterLiquidDeath : finishHeroLiquidMonsterDeath,
                monsterMoving: !!game.context.mon_moving,
            });
        }
    }
}
function floorBoulderAt(x, y) {
    return requireGameLevel(game).objects[x]?.[y]?.find(object => object.otyp === BOULDER);
}
// C trap.c:trap_ice_effects(..., TRUE).
async function meltIceTrap(x, y) {
    const trap = requireGameLevel(game).traps.find(candidate => candidate.tx === x && candidate.ty === y);
    if (!trap)
        return;
    const monster = monsterAtPosition(requireGameLevel(game), x, y);
    if (monster?.mtrapped)
        monster.mtrapped = 0;
    if (trap.ttyp === LANDMINE || trap.ttyp === BEAR_TRAP) {
        await convertTrapToObject(trap, trap.ttyp === LANDMINE ? LAND_MINE : BEARTRAP, 1, game, { bury: true });
    }
    else if (trap.ttyp !== MAGIC_PORTAL && trap.ttyp !== VIBRATING_SQUARE) {
        deleteTrap(trap);
    }
}
//# sourceMappingURL=ice.js.map