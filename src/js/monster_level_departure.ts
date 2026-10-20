// C mon.c:relmon(), mon_leaving_level(), and dmonsfree(). Departures retain
// their coordinates; death removes map occupancy before unlinking the chain.
import type { Monster } from './monster_types.js';
import type { GameState } from './game_state.js';
import type { GameMap } from './game.js';
import { isok, MON_DETACH, MON_FLOOR } from './const.js';
import { newsym } from './display.js';
import { game, requireGameLevel, requireLiveGame } from './gstate.js';
import { releaseHeroFromMonster } from './hero_expulsion.js';
import { revealMonsterAppearance } from './monster_appearance.js';
import { monsterAtPosition } from './monster_location.js';
import { clearMonsterWormFromMap } from './monster_worm.js';
import { fillPitWithBoulderAt } from './pit_fill.js';

export async function detachMonsterFromLevel(
    monster: Monster, state: GameState = game,
    { dueToDeath = false, stayLinked = false }: { dueToDeath?: boolean; stayLinked?: boolean } = {},
): Promise<void> {
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

    // Native m_detach removes map occupancy immediately but leaves the
    // identity in fmon until movemon's dmonsfree. A death during distress
    // still participates in this turn's movement allocation.
    if (dueToDeath) monster.mstate = (monster.mstate ?? MON_FLOOR) | MON_DETACH;
    else if (!stayLinked) level.monsters = level.monsters.filter(candidate => candidate !== monster);
    if (onMap) {
        monster.mundetected = 0;
        revealMonsterAppearance(monster, { includeMonsterDisguise: false });
    }
    // mnearto() keeps a displaced monster in fmon, zeroing its coordinates
    // after mon_leaving_level() has unhidden it at the vacated square.
    if (stayLinked) {
        monster.mx = 0;
        monster.my = 0;
    }
    if (onMap) {
        await fillPitWithBoulderAt(x, y, state);
        newsym(x, y);
    }
    if (state.context.polearm?.hitmonId === monster.m_id)
        state.context.polearm.hitmonId = null;
}

// C mon.c:dmonsfree(), called after movement and before saving a level.
// A dead guard stays linked while its temporary corridor needs cleanup.
export function purgeDeadMonsters(level: GameMap): void {
    level.monsters = level.monsters.filter(monster => monster.mhp > 0 || !!monster.isgd);
}
