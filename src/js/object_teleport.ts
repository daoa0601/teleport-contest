// Random object relocation, including floor effects and shop ownership.
// C teleport.c:rloco() and goodpos(..., NULL, 0).

import {
    COLNO, ROWNO, SHOPBASE,
} from './const.js';
import { reviveCorpseImmediately } from './corpse_revival.js';
import { isRider } from './corpse_species.js';
import { goodPosition } from './teleport_rules.js';
import { newsym, plineWithContinuation } from './display.js';
import { insideWizardTower } from './dungeon.js';
import { applyFloorEffects } from './floor_effects.js';
import { placeObject } from './floor_object.js';
import { game, requireGameLevel, requireLiveGame } from './gstate.js';
import type { GameObject } from './object_types.js';
import type { GameState } from './game_state.js';
import type { ArrivalRegion, Position, Rectangle } from './map_types.js';
import type { MessagePublisher } from './display.js';
import { CORPSE } from './object_data.js';
import { unlinkObject } from './object_location.js';
import { rn2 } from './rng.js';
import { roomsAt } from './room.js';
import {
    addShopObjectToBill, costlyAdjacent, costlySpot,
    removeObjectAndContentsFromBill,
} from './shk.js';
import { findObjectOwner, stolenValue } from './shop_loss.js';

export async function relocateObjectRandomly(object: GameObject, {
    state = game, publish = plineWithContinuation, random = rn2,
}: {
    state?: GameState;
    publish?: MessagePublisher;
    random?: (limit: number) => number;
} = {}): Promise<boolean> {
    requireLiveGame(state);
    if (object.otyp === CORPSE && isRider(object.corpsenm)) {
        const revival = await reviveCorpseImmediately(object, state);
        if (!revival) throw new Error('Corpse revival returned no result for a Rider corpse');
        for (const message of revival.messages) await publish(message);
        if (revival.monster) return false;
    }

    unlinkObject(object, state);
    const oldx = object.ox, oldy = object.oy;
    const region = requireGameLevel(state).downTeleportRegion;
    const { x, y } = relocationPosition(oldx, oldy, region, state, random);

    const result = await applyFloorEffects(object, x, y, { state, publish, random });
    if (result.finished) {
        if (oldx !== 0 || oldy !== 0) newsym(oldx, oldy);
        return false;
    }
    if (oldx !== 0 || oldy !== 0) {
        await settleRelocatedObject(object, oldx, oldy, x, y, state, publish);
        newsym(oldx, oldy);
    }
    await placeObject(object, x, y, state);
    newsym(x, y);
    return true;
}

function relocationPosition(
    oldx: number, oldy: number, region: ArrivalRegion | null | undefined,
    state: GameState, random: (limit: number) => number,
): Position {
    const fallRegion = oldx === 0 && region?.lx ? region : null;
    for (let attempt = 0; ; attempt++) {
        const x = random(COLNO - 3) + 2;
        const y = random(ROWNO);
        // Native uses the final candidate after exhausting its position search.
        if (attempt === 3999) return { x, y };
        if (!goodPosition(x, y, null, { state, random })) continue;
        if (fallRegion && (!inside(fallRegion, x, y)
            || (fallRegion.exclude?.lx && inside(fallRegion.exclude, x, y)))) continue;
        if (region?.exclude?.lx
            && insideWizardTower(x, y, state)
                !== insideWizardTower(oldx, oldy, state)) continue;
        return { x, y };
    }
}

function inside(region: Rectangle, x: number, y: number): boolean {
    return x >= region.lx && x <= region.hx
        && y >= region.ly && y <= region.hy;
}

async function settleRelocatedObject(
    object: GameObject, oldx: number, oldy: number, x: number, y: number,
    state: GameState, publish: MessagePublisher,
): Promise<void> {
    const level = requireGameLevel(state);
    const owner = findObjectOwner(object, oldx, oldy, state);
    if (!owner || !(costlySpot(oldx, oldy, state)
        || (object.unpaid && costlyAdjacent(owner, oldx, oldy, state)))) return;
    const heroRoom = roomsAt(level, state.u.ux, state.u.uy, SHOPBASE)[0];
    const oldRoom = roomsAt(level, oldx, oldy)[0];
    const heroInShop = heroRoom
        && roomsAt(level, owner.mx, owner.my).includes(heroRoom);
    const sameShop = oldRoom && roomsAt(level, x, y).includes(oldRoom);
    if (heroInShop && sameShop && costlySpot(x, y, state)) {
        if (object.unpaid)
            removeObjectAndContentsFromBill(object, state, { resident: owner });
    } else if (heroInShop && sameShop && costlyAdjacent(owner, x, y, state)) {
        if (!object.unpaid)
            await addShopObjectToBill(object, state, { ininv: false, publish });
    } else {
        await stolenValue(object, oldx, oldy, false, { silent: false, state, publish });
    }
}
