// Container predicates and the two mkobj.c helpers the pickup.c container
// transfers share. The pickup.c use_container()/in_container()/out_container()
// ports live in pickup.ts; this module keeps mkobj.c container_weight()
// (updateContainerWeights) and unsplitobj() (restoreRejectedSplit).
import { objectWeight, rejoinObjectStack } from './mkobj.js';
import { BAG_OF_HOLDING, BAG_OF_TRICKS, CHEST, ICE_BOX, LARGE_BOX, OILSKIN_SACK, SACK } from './object_data.js';
export const CONTAINER_TYPES = new Set([
    LARGE_BOX, CHEST, ICE_BOX, SACK, BAG_OF_HOLDING, OILSKIN_SACK, BAG_OF_TRICKS,
]);
export function isContainer(object) {
    return !!object && CONTAINER_TYPES.has(object.otyp);
}
// C mkobj.c:container_weight().
export function updateContainerWeights(container) {
    let current = container;
    const visited = new Set();
    while (current && !visited.has(current)) {
        visited.add(current);
        current.owt = objectWeight(current);
        current = current.where === 'contained' ? current.container : null;
    }
}
// C unsplitobj(): a failed merge leaves the split piece beside its parent.
export async function restoreRejectedSplit(transfer, state) {
    if (transfer.parent)
        await rejoinObjectStack(transfer.parent, transfer.object, state);
}
//# sourceMappingURL=container.js.map