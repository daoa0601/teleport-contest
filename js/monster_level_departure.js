import { isok } from './const.js';
import { newsym } from './display.js';
import { game, requireGameLevel, requireLiveGame } from './gstate.js';
import { releaseHeroFromMonster } from './hero_expulsion.js';
import { revealMonsterAppearance } from './monster_appearance.js';
import { monsterAtPosition } from './monster_location.js';
import { clearMonsterWormFromMap } from './monster_worm.js';
import { fillPitWithBoulderAt } from './pit_fill.js';
export async function detachMonsterFromLevel(monster, state = game) {
    requireLiveGame(state);
    const level = requireGameLevel(state);
    const { mx: x, my: y } = monster;
    const onMap = isok(x, y) && monsterAtPosition(level, x, y) === monster;
    const parkedAtOrigin = monsterAtPosition(level, 0, 0) === monster;
    // A settling boulder must not damage the departing actor recursively.
    monster.mtrapped = 0;
    await releaseHeroFromMonster(monster, { state });
    if ((onMap || parkedAtOrigin) && monster.wormno)
        clearMonsterWormFromMap(monster);
    // The port derives occupied map squares from the level list. Remove
    // occupancy before revealing a light-blocking disguise or filling a pit.
    level.monsters = level.monsters.filter(candidate => candidate !== monster);
    if (onMap) {
        monster.mundetected = 0;
        revealMonsterAppearance(monster, { includeMonsterDisguise: false });
        await fillPitWithBoulderAt(x, y, state);
        newsym(x, y);
    }
    if (state.context.polearm?.hitmonId === monster.m_id)
        state.context.polearm.hitmonId = null;
}
//# sourceMappingURL=monster_level_departure.js.map