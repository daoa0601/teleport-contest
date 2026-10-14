import { hasShopkeeperData } from './shop_types.js';
import type { Monster } from './monster_types.js';
import type { GameObject } from './object_types.js';
// Remove a monster which leaves the game without dying.
// C mon.c:mongone().

import { prepareVaultGuardDeath } from './vault_guard.js';
import { DISMOUNT_GENERIC } from './const.js';
import { armorThiefGone } from './command_state.js';
import { game, requireLiveGame } from './gstate.js';
import { finishShopkeeperDeparture } from './shop_damage.js';
import { releaseHeroFromMonster } from './hero_expulsion.js';
import { discardMonsterInventory, dropSpecialMonsterObjects } from './monster_drop.js';
import { removeMonsterWormBody } from './monster_worm.js';
import { releaseMonsterLeash } from './monster_leash.js';
import { detachMonsterFromLevel } from './monster_level_departure.js';
import { wizardDeadOrGone } from './wizard.js';
import { dismountHero } from './steed.js';

interface MonsterDepartureResult {
    removed: boolean;
    dropped: GameObject[];
    discarded: GameObject[];
    x?: number;
    y?: number;
}

export async function removeMonsterFromGame(monster: Monster | null | undefined): Promise<MonsterDepartureResult> {
    requireLiveGame(game);
    if (!monster) {
        return { removed: false, dropped: [], discarded: [] };
    }

    const gameWasOver = game.program_state.gameover;
    const x = monster.mx, y = monster.my;
    monster.mhp = 0;
    if (monster.isgd && !await prepareVaultGuardDeath(monster))
        return { removed: false, dropped: [], discarded: [], x, y };
    await releaseHeroFromMonster(monster);
    const dropped = await dropSpecialMonsterObjects(monster);
    const discarded = await discardMonsterInventory(monster, false);
    if (monster.mleashed) releaseMonsterLeash(monster);
    await detachMonsterFromLevel(monster);
    // End-game settlement starts removals after gameover is already set.
    // Only a new death during this removal interrupts the remaining cleanup.
    if (!gameWasOver && game.program_state.gameover)
        return { removed: true, dropped, discarded, x, y };
    if (monster.iswiz) wizardDeadOrGone();
    armorThiefGone(monster);
    if (monster.isshk) {
        if (!hasShopkeeperData(monster)) throw new Error('shopkeeper lacks shop history');
        finishShopkeeperDeparture(monster);
    }
    if (monster.wormno) removeMonsterWormBody(monster);
    monster.dead = true;
    if (game.u.usteed === monster) await dismountHero(DISMOUNT_GENERIC);
    return { removed: true, dropped, discarded, x, y };
}

export async function removeWishGrantingMonster(monster: Monster | null | undefined): Promise<MonsterDepartureResult> {
    return await removeMonsterFromGame(monster);
}
