// Container predicates and the two mkobj.c helpers the pickup.c container
// transfers share. The pickup.c use_container()/in_container()/out_container()
// ports live in pickup.ts; this module keeps mkobj.c container_weight()
// (updateContainerWeights) and unsplitobj() (restoreRejectedSplit).

import { objectWeight, rejoinObjectStack } from './mkobj.js';
import { BAG_OF_HOLDING, BAG_OF_TRICKS, CHEST, ICE_BOX, LARGE_BOX, OILSKIN_SACK, SACK } from './object_data.js';
import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';

export interface TransferStack { object: GameObject; parent: GameObject | null }

export const CONTAINER_TYPES = new Set([
    LARGE_BOX, CHEST, ICE_BOX, SACK, BAG_OF_HOLDING, OILSKIN_SACK, BAG_OF_TRICKS,
]);

export function isContainer(object: Pick<GameObject, 'otyp'> | null | undefined): boolean {
    return !!object && CONTAINER_TYPES.has(object.otyp);
}

// C mkobj.c:container_weight().
export function updateContainerWeights(container: GameObject): void {
    let current: GameObject | null | undefined = container;
    const visited = new Set<GameObject>();
    while (current && !visited.has(current)) {
        visited.add(current);
        current.owt = objectWeight(current);
        current = current.where === 'contained' ? current.container : null;
    }
}

// C unsplitobj(): a failed merge leaves the split piece beside its parent.
export async function restoreRejectedSplit(transfer: TransferStack, state: GameState): Promise<void> {
    if (transfer.parent) await rejoinObjectStack(transfer.parent, transfer.object, state);
}
