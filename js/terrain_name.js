// C ref: dungeon.c surface().
import { ALTAR, CLOUD, DOOR, DRAWBRIDGE_DOWN, FOUNTAIN, GRAVE, ICE, IS_AIR, IS_ROOM, IS_WALL, Is_waterlevel, Is_earthlevel, Is_firelevel, In_quest, SHOPBASE, TEMPLE, VAULT, SDOOR, DRAWBRIDGE_UP, LAVAPOOL, LAVAWALL, MOAT, POOL, WATER, isok, } from './const.js';
import { game, requireGameLevel } from './gstate.js';
import { displayLiquidName } from './display.js';
import { drawbridgeUnderlyingType } from './drawbridge_terrain.js';
import { isIceAt, isLavaAt, isPoolAt } from './terrain_properties.js';
import { onQuestStart } from './quest.js';
import { heroIsHallucinating } from './senses.js';
import { roomsAt } from './room.js';
import { monsterDigests, monsterEnfolds, monsterIsAnimal } from './monster_data.js';
// C pager.c:waterbody_name(). The liquid name is chosen before a caller
// changes terrain, even when that caller will not print it.
export function waterbodyName(x, y, state = game) {
    if (!isok(x, y))
        return 'drink';
    const location = requireGameLevel(state).requireAt(x, y);
    const type = location.typ === DRAWBRIDGE_UP
        ? drawbridgeUnderlyingType(location.drawbridgemask ?? 0) : location.typ;
    const hallucinating = heroIsHallucinating(state) && !state.program_state.gameover;
    if (type === LAVAPOOL)
        return `molten ${displayLiquidName('lava', state)}`;
    if (type === ICE)
        return hallucinating
            ? `frozen ${displayLiquidName('water', state)}` : 'ice';
    if (type === POOL)
        return `pool of ${displayLiquidName('water', state)}`;
    if (type === MOAT) {
        if (hallucinating)
            return `deep ${displayLiquidName('water', state)}`;
        const here = (level) => !!level && level.dnum === state.u.uz?.dnum
            && level.dlevel === state.u.uz?.dlevel;
        if (here(state.medusa_level))
            return 'shallow sea';
        if (here(state.juiblex_level))
            return 'swamp';
        if (state.urole?.key === 'samurai' && onQuestStart(state))
            return 'pond';
        return 'moat';
    }
    if (type === WATER)
        return Is_waterlevel(state.u.uz)
            ? 'limitless water' : `wall of ${displayLiquidName('water', state)}`;
    if (type === LAVAWALL)
        return `wall of ${displayLiquidName('lava', state)}`;
    return 'water';
}
export function surfaceName(x, y, state = game) {
    const location = state.level?.at(x, y);
    if (!location)
        return 'ground';
    const type = location.typ === DRAWBRIDGE_UP
        ? drawbridgeUnderlyingType(location.drawbridgemask ?? 0) : location.typ;
    const engulfer = state.u.ustuck;
    if (x === state.u.ux && y === state.u.uy && state.u.uswallow
        && engulfer && monsterIsAnimal(engulfer))
        return monsterDigests(engulfer) ? 'maw' : monsterEnfolds(engulfer) ? 'husk' : 'nonesuch';
    if (IS_AIR(type))
        return Is_waterlevel(state.u.uz) ? 'air bubble' : type === CLOUD ? 'cloud' : 'air';
    if (isPoolAt(x, y, state))
        return (state.underwater || state.u.uinwater) && !Is_waterlevel(state.u.uz)
            ? 'bottom' : displayLiquidName('water', state);
    if (isIceAt(x, y, state))
        return 'ice';
    if (isLavaAt(x, y, state))
        return displayLiquidName('lava', state);
    if (type === DRAWBRIDGE_DOWN)
        return 'bridge';
    if (type === ALTAR)
        return 'altar';
    if (type === GRAVE)
        return 'headstone';
    if (type === FOUNTAIN)
        return 'fountain';
    for (let stair = state.stairs; stair; stair = stair.next) {
        if (stair.sx === x && stair.sy === y)
            return 'stairs';
    }
    if (IS_WALL(type) || type === SDOOR)
        return 'wall';
    if (type === DOOR)
        return 'doorway';
    return IS_ROOM(type) && !Is_earthlevel(state.u.uz) ? 'floor' : 'ground';
}
// C ref: dungeon.c ceiling().
export function ceilingName(x, y, state = game) {
    const type = state.level?.at?.(x, y)?.typ;
    if (roomsAt(state.level, x, y, VAULT).length)
        return "vault's ceiling";
    if (roomsAt(state.level, x, y, TEMPLE).length)
        return "temple's ceiling";
    if (roomsAt(state.level, x, y, SHOPBASE).length)
        return "shop's ceiling";
    if (Is_waterlevel(state.u?.uz))
        return 'water above';
    if (type !== undefined && IS_AIR(type))
        return 'sky';
    if (Is_firelevel(state.u?.uz))
        return 'flames above';
    if (In_quest(state.u?.uz))
        return 'expanse above';
    if (state.underwater || state.u?.uinwater)
        return "water's surface";
    return type !== undefined && ((IS_ROOM(type) && !Is_earthlevel(state.u?.uz))
        || IS_WALL(type) || type === DOOR || type === SDOOR)
        ? 'ceiling' : 'rock cavern';
}
//# sourceMappingURL=terrain_name.js.map